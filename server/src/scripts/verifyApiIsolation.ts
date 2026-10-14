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
  console.log('=====================================================');
  console.log(' LIVE HTTP API MULTI-COMPANY ISOLATION TESTS');
  console.log('=====================================================\n');

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

  // 1. Login as Platform Super Admin
  const saLogin = await makeRequest('POST', '/api/auth/login', {}, {
    email: 'superadmin@hrms.local',
    password: 'password123'
  });
  const saToken = saLogin.body.data?.token || saLogin.body.token;
  assert(saLogin.status === 200 && !!saToken, '1. Platform Super Admin can log in', `Status: ${saLogin.status}`);

  // 2. Super Admin can view all registered companies
  const companiesRes = await makeRequest('GET', '/api/companies', {
    Authorization: `Bearer ${saToken}`
  });
  assert(
    companiesRes.status === 200 && Array.isArray(companiesRes.body.data) && companiesRes.body.data.length >= 2,
    '2. Super Admin can access SaaS Platform Companies list (/api/companies)',
    `Count: ${companiesRes.body.data?.length}`
  );

  const apexCompany = companiesRes.body.data.find((c: any) => c.code === 'APEX_CORP');
  const betaCompany = companiesRes.body.data.find((c: any) => c.code === 'BETA_CORP');
  assert(!!apexCompany && !!betaCompany, '3. Both Apex Group and Beta Logistics present in Platform Registry');

  // 3. Super Admin can view company overview metrics
  const overviewRes = await makeRequest('GET', `/api/companies/${apexCompany.id}/overview`, {
    Authorization: `Bearer ${saToken}`
  });
  assert(
    overviewRes.status === 200 && overviewRes.body.data?.brands?.length >= 3,
    '4. Super Admin can view Apex Group overview metrics (/api/companies/:id/overview)'
  );

  // 4. Login as Company A HR (Apex Group)
  const aLogin = await makeRequest('POST', '/api/auth/login', {}, {
    email: 'grouphr@hrms.local',
    password: 'password123'
  });
  const aToken = aLogin.body.data?.token || aLogin.body.token;
  assert(aLogin.status === 200 && !!aToken, '5. Company A HR (grouphr@hrms.local) can log in');

  // 5. Company A HR cannot access SaaS Company Management endpoint
  const unauthorizedCompaniesRes = await makeRequest('GET', '/api/companies', {
    Authorization: `Bearer ${aToken}`
  });
  assert(
    unauthorizedCompaniesRes.status === 403,
    '6. Company A HR is blocked (403 Forbidden) from Platform Companies endpoint (/api/companies)'
  );

  // 6. Company A HR retrieves employees in Company A scope
  const aEmployees = await makeRequest('GET', '/api/employees', {
    Authorization: `Bearer ${aToken}`,
    'X-Company-Id': apexCompany.id
  });
  assert(
    aEmployees.status === 200 && Array.isArray(aEmployees.body.data) && aEmployees.body.data.length >= 7,
    '7. Company A HR retrieves all 7 Apex employees'
  );
  const containsBetaInA = aEmployees.body.data.some((e: any) => e.employeeId === 'BETA-1001');
  assert(!containsBetaInA, '8. Zero Company B employees leak into Company A employee list');

  // 7. Login as Company B Admin (Beta Logistics)
  const bLogin = await makeRequest('POST', '/api/auth/login', {}, {
    email: 'admin@betalogistics.com',
    password: 'BetaAdmin123!'
  });
  const bToken = bLogin.body.data?.token || bLogin.body.token;
  assert(bLogin.status === 200 && !!bToken, '9. Company B Administrator (admin@betalogistics.com) can log in');

  // 8. Company B Admin retrieves employees in Company B scope
  const bEmployees = await makeRequest('GET', '/api/employees', {
    Authorization: `Bearer ${bToken}`,
    'X-Company-Id': betaCompany.id
  });
  assert(
    bEmployees.status === 200 && Array.isArray(bEmployees.body.data) && bEmployees.body.data.length === 1,
    '10. Company B Admin sees exactly 1 employee in Beta Logistics'
  );
  assert(bEmployees.body.data[0].employeeId === 'BETA-1001', '11. Company B sees BETA-1001 (Rajesh Kumar)');

  // 9. Cross-Company Spoofing Test: Company A HR attempts to force X-Company-Id to Company B
  const spoofAttempt = await makeRequest('GET', '/api/employees', {
    Authorization: `Bearer ${aToken}`,
    'X-Company-Id': betaCompany.id // Attempting to inspect Beta Logistics!
  });
  // Server-side auth middleware validates that user has no membership in Beta Logistics,
  // therefore it rejects the header or ignores it and resolves only authorized company!
  const leakedToA = spoofAttempt.body.data?.some((e: any) => e.employeeId === 'BETA-1001');
  assert(
    !leakedToA,
    '12. Cross-Tenant Header Spoofing Prevented: Company A user sending Beta company ID gets 0 Beta records'
  );

  // 10. Direct Record Access: Company B Admin tries to view Company A employee by ID
  const apexEmployeeId = aEmployees.body.data[0].id;
  const crossAccess = await makeRequest('GET', `/api/employees/${apexEmployeeId}`, {
    Authorization: `Bearer ${bToken}`,
    'X-Company-Id': betaCompany.id
  });
  assert(
    crossAccess.status === 404 || crossAccess.status === 403,
    '13. Direct Record Cross-Tenant Access Blocked: Beta Admin requesting Apex employee gets 404/403',
    `Status: ${crossAccess.status}`
  );

  // 11. Brands Isolation: Company B only sees Beta Express Fleet
  const bBrands = await makeRequest('GET', '/api/brands', {
    Authorization: `Bearer ${bToken}`,
    'X-Company-Id': betaCompany.id
  });
  assert(
    bBrands.status === 200 && bBrands.body.data?.length === 1 && bBrands.body.data[0].code === 'BETA_EXP',
    '14. Brands API returns only Company B brands for Company B Admin'
  );

  // 12. Assets Isolation: Company B only sees Zebra Scanner
  const bAssets = await makeRequest('GET', '/api/assets', {
    Authorization: `Bearer ${bToken}`,
    'X-Company-Id': betaCompany.id
  });
  assert(
    bAssets.status === 200 && bAssets.body.data?.length === 1 && bAssets.body.data[0].assetTag === 'ASSET-BETA-SCAN-01',
    '15. Assets API returns only Company B assets for Company B Admin'
  );

  console.log('\n=====================================================');
  console.log(` SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=====================================================\n');

  if (failed === 0) {
    console.log('[SUCCESS] All Live HTTP API Multi-Company Isolation checks PASSED!\n');
  } else {
    process.exit(1);
  }
}

runApiVerification().catch((err) => {
  console.error('API Verification error:', err);
  process.exit(1);
});
