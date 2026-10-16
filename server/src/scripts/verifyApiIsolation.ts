import http from 'http';

function makeRequest(
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body?: any
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const reqHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers
    };
    if (body) {
      reqHeaders['Content-Length'] = Buffer.byteLength(postData).toString();
    }

    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path,
        method,
        headers: reqHeaders
      },
      (res) => {
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        res.on('end', () => {
          let parsed: any;
          try {
            parsed = JSON.parse(responseData);
          } catch {
            parsed = responseData;
          }
          resolve({ status: res.statusCode || 500, body: parsed });
        });
      }
    );

    req.on('error', (err) => reject(err));
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runApiVerification() {
  console.log('================================================================');
  console.log(' LIVE HTTP API MULTI-COMPANY HRMS (ADMIN & HR ROLES) TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} - ${detail || ''}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // Test 1: Only ADMIN and HR roles are accepted
  // -------------------------------------------------------------
  const empLogin = await makeRequest('POST', '/api/auth/login', {}, {
    email: 'employee.apex@hrms.local',
    password: 'password123'
  });
  assert(empLogin.status === 401 || empLogin.status === 403, '1. Former EMPLOYEE role is rejected (401/403)');

  const mgrLogin = await makeRequest('POST', '/api/auth/login', {}, {
    email: 'manager.apex@hrms.local',
    password: 'password123'
  });
  assert(mgrLogin.status === 401 || mgrLogin.status === 403, '2. Former MANAGER role is rejected (401/403)');

  const superAdminLogin = await makeRequest('POST', '/api/auth/login', {}, {
    email: 'superadmin@hrms.local',
    password: 'password123'
  });
  assert(superAdminLogin.status === 401 || superAdminLogin.status === 403, '3. Obsolete SUPER_ADMIN account is quarantined / rejected (401/403)');

  // -------------------------------------------------------------
  // Test 2: Admin Authentication and Management Access
  // -------------------------------------------------------------
  const adminLogin = await makeRequest('POST', '/api/auth/login', {}, {
    email: 'admin@hrms.local',
    password: 'password123'
  });
  const adminToken = adminLogin.body.data?.token || adminLogin.body.token;
  assert(adminLogin.status === 200 && !!adminToken, '4. Admin user (admin@hrms.local) logs in with ADMIN role');

  const companiesRes = await makeRequest('GET', '/api/companies', {
    Authorization: `Bearer ${adminToken}`
  });
  assert(
    companiesRes.status === 200 && Array.isArray(companiesRes.body.data) && companiesRes.body.data.length >= 2,
    '5. Admin can access platform company registry (/api/companies)',
    `Found ${companiesRes.body.data?.length} companies`
  );

  const apexComp = companiesRes.body.data.find((c: any) => c.code === 'APEX_CORP');
  const betaComp = companiesRes.body.data.find((c: any) => c.code === 'BETA_CORP');
  assert(!!apexComp && !!betaComp, '6. Apex Corp and Beta Corp exist in registry');

  // Admin access to HR management
  const hrListRes = await makeRequest('GET', '/api/hr-management', {
    Authorization: `Bearer ${adminToken}`
  });
  assert(
    hrListRes.status === 200 && Array.isArray(hrListRes.body.data),
    '7. Admin can access HR Management list (/api/hr-management)'
  );

  // -------------------------------------------------------------
  // Test 3: Admin creates HR account with multi-company assignments
  // -------------------------------------------------------------
  const testHrEmail = `test.hr.${Date.now()}@hrms.local`;
  const createHrRes = await makeRequest('POST', '/api/hr-management', {
    Authorization: `Bearer ${adminToken}`
  }, {
    firstName: 'Automation',
    lastName: 'Tester',
    email: testHrEmail,
    password: 'Password123!',
    phone: '+1 555-9988',
    companyIds: [apexComp.id, betaComp.id]
  });

  assert(
    (createHrRes.status === 200 || createHrRes.status === 201) && createHrRes.body.data?.assignments?.length === 2,
    '8. Admin creates HR user with multi-company assignments (Apex & Beta)',
    `Status: ${createHrRes.status}, Assignments: ${createHrRes.body.data?.assignments?.length}`
  );
  const createdHrId = createHrRes.body.data?.id;

  // -------------------------------------------------------------
  // Test 4: New HR logs in and verifies access to both companies
  // -------------------------------------------------------------
  const newHrLogin = await makeRequest('POST', '/api/auth/login', {}, {
    email: testHrEmail,
    password: 'Password123!'
  });
  const newHrToken = newHrLogin.body.data?.token || newHrLogin.body.token;
  const newHrCompanies = newHrLogin.body.data?.companies || newHrLogin.body.data?.user?.companies;
  assert(newHrLogin.status === 200 && !!newHrToken, '9. Newly created HR user logs in successfully');
  assert(
    newHrCompanies?.length === 2,
    '10. Newly created HR user receives 2 authorized companies on login'
  );

  // Access Company A with X-Company-Id
  const newHrInCompA = await makeRequest('GET', '/api/employees', {
    Authorization: `Bearer ${newHrToken}`,
    'X-Company-Id': apexComp.id
  });
  assert(
    newHrInCompA.status === 200 && Array.isArray(newHrInCompA.body.data),
    '11. Multi-Company HR accesses Company A employees'
  );

  // Access Company B with X-Company-Id
  const newHrInCompB = await makeRequest('GET', '/api/employees', {
    Authorization: `Bearer ${newHrToken}`,
    'X-Company-Id': betaComp.id
  });
  assert(
    newHrInCompB.status === 200 && Array.isArray(newHrInCompB.body.data),
    '12. Multi-Company HR switches to Company B employees safely'
  );

  // -------------------------------------------------------------
  // Test 5: Immediate Revocation - Admin removes Company B assignment
  // -------------------------------------------------------------
  const updateAssignmentsRes = await makeRequest('PUT', `/api/hr-management/${createdHrId}/companies`, {
    Authorization: `Bearer ${adminToken}`
  }, {
    companyIds: [apexComp.id] // Beta removed!
  });
  assert(
    updateAssignmentsRes.status === 200 && updateAssignmentsRes.body.data?.assignments?.length === 1,
    '13. Admin updates HR assignments to Company A only (Beta removed)'
  );

  // Immediate Revocation check: Using the OLD token to access Company B must immediately fail with 403
  const revokedAccessCheck = await makeRequest('GET', '/api/employees', {
    Authorization: `Bearer ${newHrToken}`,
    'X-Company-Id': betaComp.id
  });
  assert(
    revokedAccessCheck.status === 403,
    '14. Immediate access revocation: Request to removed company using existing token returns 403 Forbidden',
    `Status: ${revokedAccessCheck.status}`
  );

  // Still has access to Company A
  const stillHasCompA = await makeRequest('GET', '/api/employees', {
    Authorization: `Bearer ${newHrToken}`,
    'X-Company-Id': apexComp.id
  });
  assert(
    stillHasCompA.status === 200,
    '15. HR still retains authorized access to Company A'
  );

  // -------------------------------------------------------------
  // Test 6: Single-Company HR access boundary (hr.apex@hrms.local)
  // -------------------------------------------------------------
  const apexHrLogin = await makeRequest('POST', '/api/auth/login', {}, {
    email: 'hr.apex@hrms.local',
    password: 'password123'
  });
  const apexHrToken = apexHrLogin.body.data?.token || apexHrLogin.body.token;
  const apexHrCompanies = apexHrLogin.body.data?.companies || apexHrLogin.body.data?.user?.companies;
  assert(apexHrLogin.status === 200 && !!apexHrToken, '16. Single-Company HR (hr.apex@hrms.local) logs in');
  assert(apexHrCompanies?.length === 1, '17. Single-Company HR receives exactly 1 company');

  // Attempt to access Company B
  const apexHrToBeta = await makeRequest('GET', '/api/employees', {
    Authorization: `Bearer ${apexHrToken}`,
    'X-Company-Id': betaComp.id
  });
  assert(
    apexHrToBeta.status === 403,
    '18. Single-Company HR is blocked (403) from accessing unauthorized Company B',
    `Status: ${apexHrToBeta.status}`
  );

  // -------------------------------------------------------------
  // Test 7: HR with 0 company assignments (hr.unassigned@hrms.local)
  // -------------------------------------------------------------
  const unassignedLogin = await makeRequest('POST', '/api/auth/login', {}, {
    email: 'hr.unassigned@hrms.local',
    password: 'password123'
  });
  const unassignedToken = unassignedLogin.body.data?.token || unassignedLogin.body.token;
  const unassignedCompanies = unassignedLogin.body.data?.companies || unassignedLogin.body.data?.user?.companies;
  const unassignedActive = unassignedLogin.body.data?.activeCompany !== undefined ? unassignedLogin.body.data.activeCompany : unassignedLogin.body.data?.user?.activeCompany;
  assert(
    unassignedLogin.status === 200 &&
    unassignedCompanies?.length === 0 &&
    (unassignedActive === null || unassignedActive === undefined),
    '19. Unassigned HR authenticates gracefully without crashing (0 companies, null activeCompany)'
  );

  const unassignedAttempt = await makeRequest('GET', '/api/employees', {
    Authorization: `Bearer ${unassignedToken}`
  });
  assert(
    unassignedAttempt.status === 403,
    '20. Unassigned HR cannot access company-scoped modules (403 Forbidden)',
    `Status: ${unassignedAttempt.status}`
  );

  // -------------------------------------------------------------
  // Test 8: Non-Admin blocked from Admin HR Management endpoint
  // -------------------------------------------------------------
  const hrForbiddenRes = await makeRequest('GET', '/api/hr-management', {
    Authorization: `Bearer ${apexHrToken}`
  });
  assert(
    hrForbiddenRes.status === 403,
    '21. HR user is strictly blocked (403) from Admin HR Management endpoint (/api/hr-management)'
  );

  // -------------------------------------------------------------
  // Test 9: Tenant Data Isolation (Company A vs Company B)
  // -------------------------------------------------------------
  const multiHrLogin = await makeRequest('POST', '/api/auth/login', {}, {
    email: 'hr.multi@hrms.local',
    password: 'password123'
  });
  const multiHrToken = multiHrLogin.body.data?.token || multiHrLogin.body.token;

  const aEmployees = await makeRequest('GET', '/api/employees', {
    Authorization: `Bearer ${multiHrToken}`,
    'X-Company-Id': apexComp.id
  });
  const bEmployees = await makeRequest('GET', '/api/employees', {
    Authorization: `Bearer ${multiHrToken}`,
    'X-Company-Id': betaComp.id
  });

  const aHasBeta = aEmployees.body.data?.some((e: any) => e.companyId === betaComp.id || e.employeeId === 'BETA-1001');
  const bHasApex = bEmployees.body.data?.some((e: any) => e.companyId === apexComp.id);

  assert(
    !aHasBeta && !bHasApex && aEmployees.body.data?.length >= 7 && bEmployees.body.data?.length >= 1,
    '22. Data isolation verified: Zero cross-company employee record leakage across workspaces'
  );

  console.log('\n================================================================');
  console.log(` SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed === 0) {
    console.log('[SUCCESS] All Live API Multi-Company & Two-Role Tests PASSED!\n');
  } else {
    process.exit(1);
  }
}

runApiVerification().catch((err) => {
  console.error('API Verification error:', err);
  process.exit(1);
});
