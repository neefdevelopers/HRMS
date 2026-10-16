import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5000/api';

async function runComprehensiveVerification() {
  console.log('========================================================================');
  console.log(' ATTENDANCE_VIEWER & 3-ROLE RBAC COMPREHENSIVE VERIFICATION SUITE');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} - ${details || 'Assertion failed'}`);
      failed++;
    }
  }

  // Helper for requests
  async function apiRequest(endpoint: string, options: { method?: string; token?: string; companyId?: string; body?: any }) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (options.token) headers['Authorization'] = `Bearer ${options.token}`;
    if (options.companyId) headers['X-Company-Id'] = options.companyId;

    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  }

  try {
    // 1. Data Integrity: Check Companies and Existing Records
    console.log('\n--- 1. DATABASE & HISTORICAL DATA INTEGRITY ---');
    const companies = await prisma.company.findMany();
    const employees = await prisma.employee.findMany();
    const attendances = await prisma.attendance.findMany();

    const apexComp = companies.find(c => c.code === 'APEX_CORP');
    const betaComp = companies.find(c => c.code === 'BETA_CORP');

    assert(!!apexComp && !!betaComp, '1.1 Companies Apex Group and Beta Logistics exist', `Apex: ${apexComp?.id}, Beta: ${betaComp?.id}`);
    assert(employees.length >= 8, '1.2 Existing employees remain intact without deletion', `Found ${employees.length} employees`);
    assert(attendances.length >= 4, '1.3 Existing attendance records remain intact without reset', `Found ${attendances.length} records`);

    const apexId = apexComp!.id;
    const betaId = betaComp!.id;

    // 2. Authentication & Role Resolution
    console.log('\n--- 2. AUTHENTICATION & LOGIN ROLE RESOLUTION ---');
    const adminLogin = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email: 'admin@hrms.local', password: 'password123' }
    });
    assert(adminLogin.status === 200 && adminLogin.data.data.user.role === 'ADMIN', '2.1 Admin logs in with ADMIN role');
    const adminToken = adminLogin.data.data.token;

    const viewerALogin = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email: 'viewer.a@hrms.local', password: 'password123' }
    });
    assert(viewerALogin.status === 200 && viewerALogin.data.data.user.role === 'ATTENDANCE_VIEWER', '2.2 Viewer A logs in with ATTENDANCE_VIEWER role');
    const viewerAToken = viewerALogin.data.data.token;

    const hybridLogin = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email: 'hybrid.user@hrms.local', password: 'password123' }
    });
    assert(hybridLogin.status === 200, '2.3 Hybrid User logs in successfully');
    const hybridToken = hybridLogin.data.data.token;

    // 3. Attendance Viewer Permitted Actions
    console.log('\n--- 3. ATTENDANCE_VIEWER PERMITTED ACTIONS ---');
    const viewerAReadAttendance = await apiRequest('/attendance', {
      token: viewerAToken,
      companyId: betaId
    });
    assert(viewerAReadAttendance.status === 200 && Array.isArray(viewerAReadAttendance.data.data), '3.1 Viewer A can read attendance for assigned company (Beta Logistics)', `Status: ${viewerAReadAttendance.status}`);

    // Verify employee data in attendance does not leak sensitive information
    if (viewerAReadAttendance.data.data.length > 0) {
      const firstRecord = viewerAReadAttendance.data.data[0];
      const hasEmp = !!firstRecord.employee;
      const leaksSalary = firstRecord.employee && ('salary' in firstRecord.employee || 'bankDetails' in firstRecord.employee);
      assert(hasEmp && !leaksSalary, '3.2 Attendance records return necessary identifiers without leaking sensitive salary/bank info');
    }

    const viewerAPunches = await apiRequest('/attendance/punches', {
      token: viewerAToken,
      companyId: betaId
    });
    assert(viewerAPunches.status === 200, '3.3 Viewer A can read raw punches for assigned company', `Status: ${viewerAPunches.status}`);

    const viewerABrands = await apiRequest('/brands', {
      token: viewerAToken,
      companyId: betaId
    });
    assert(viewerABrands.status === 200, '3.4 Viewer A can read brands for filter dropdown in Attendance page', `Status: ${viewerABrands.status}`);

    // 4. Attendance Viewer Forbidden Mutations
    console.log('\n--- 4. ATTENDANCE_VIEWER FORBIDDEN MUTATIONS (READ-ONLY) ---');
    const viewerASync = await apiRequest('/attendance/sync', {
      method: 'POST',
      token: viewerAToken,
      companyId: betaId,
      body: { syncType: 'MANUAL' }
    });
    assert(viewerASync.status === 403, '4.1 Viewer A is rejected with 403 Forbidden when triggering punch sync', `Status: ${viewerASync.status}`);

    const viewerACorrect = await apiRequest('/attendance/dummy-id/correct', {
      method: 'PUT',
      token: viewerAToken,
      companyId: betaId,
      body: { status: 'PRESENT' }
    });
    assert(viewerACorrect.status === 403, '4.2 Viewer A is rejected with 403 Forbidden when correcting attendance records', `Status: ${viewerACorrect.status}`);

    // 5. Attendance Viewer Forbidden Modules
    console.log('\n--- 5. ATTENDANCE_VIEWER FORBIDDEN OTHER HRMS MODULES ---');
    const modulesToTest = [
      { name: 'Dashboard Metrics', endpoint: '/dashboard/metrics' },
      { name: 'Employee Management', endpoint: '/employees' },
      { name: 'Leave Management', endpoint: '/leave' },
      { name: 'Salary / Payroll', endpoint: '/salary/dashboard' },
      { name: 'Shift Management', endpoint: '/shifts' },
      { name: 'Asset Management', endpoint: '/assets' },
      { name: 'Exit Management', endpoint: '/exits' },
      { name: 'Notifications', endpoint: '/notifications' },
      { name: 'Reports', endpoint: '/reports/dashboard' },
      { name: 'Company Management', endpoint: '/companies' },
      { name: 'HR Management', endpoint: '/hr-management' }
    ];

    for (const mod of modulesToTest) {
      const res = await apiRequest(mod.endpoint, {
        token: viewerAToken,
        companyId: betaId
      });
      assert(res.status === 403, `5.x Viewer A cannot access ${mod.name} (${mod.endpoint}) - Returns 403`, `Status: ${res.status}`);
    }

    // 6. Company Isolation
    console.log('\n--- 6. COMPANY ISOLATION FOR ATTENDANCE_VIEWER ---');
    const viewerACrossCompany = await apiRequest('/attendance', {
      token: viewerAToken,
      companyId: apexId // Viewer A is NOT assigned to Apex!
    });
    assert(viewerACrossCompany.status === 403, '6.1 Viewer A is rejected with 403 when attempting to access unassigned Company A', `Status: ${viewerACrossCompany.status}`);

    const viewerBCrossCompany = await apiRequest('/attendance', {
      token: (await apiRequest('/auth/login', { method: 'POST', body: { email: 'viewer.b@hrms.local', password: 'password123' } })).data.data.token,
      companyId: betaId // Viewer B is assigned to Apex, NOT Beta!
    });
    assert(viewerBCrossCompany.status === 403, '6.2 Viewer B is rejected with 403 when attempting to access unassigned Company B', `Status: ${viewerBCrossCompany.status}`);

    // 7. Dynamic Role per Company (Hybrid User)
    console.log('\n--- 7. HYBRID USER: DIFFERENT ROLES IN DIFFERENT COMPANIES ---');
    // In Beta Logistics, hybrid user is HR
    const hybridAsHrInBeta = await apiRequest('/employees', {
      token: hybridToken,
      companyId: betaId
    });
    assert(hybridAsHrInBeta.status === 200, '7.1 Hybrid user acting in Beta Logistics has HR access to /employees (Status 200)', `Status: ${hybridAsHrInBeta.status}`);

    const hybridAsHrInBetaAtt = await apiRequest('/attendance', {
      token: hybridToken,
      companyId: betaId
    });
    assert(hybridAsHrInBetaAtt.status === 200, '7.2 Hybrid user acting in Beta Logistics has HR access to /attendance (Status 200)', `Status: ${hybridAsHrInBetaAtt.status}`);

    // In Apex Group, hybrid user is ATTENDANCE_VIEWER
    const hybridAsViewerInApex = await apiRequest('/employees', {
      token: hybridToken,
      companyId: apexId
    });
    assert(hybridAsViewerInApex.status === 403, '7.3 Hybrid user acting in Apex Group is strictly ATTENDANCE_VIEWER and BLOCKED from /employees (Status 403)', `Status: ${hybridAsViewerInApex.status}`);

    const hybridAsViewerInApexAtt = await apiRequest('/attendance', {
      token: hybridToken,
      companyId: apexId
    });
    assert(hybridAsViewerInApexAtt.status === 200, '7.4 Hybrid user acting in Apex Group can view /attendance (Status 200)', `Status: ${hybridAsViewerInApexAtt.status}`);

    const hybridAsViewerInApexSync = await apiRequest('/attendance/sync', {
      method: 'POST',
      token: hybridToken,
      companyId: apexId,
      body: { syncType: 'MANUAL' }
    });
    assert(hybridAsViewerInApexSync.status === 403, '7.5 Hybrid user acting in Apex Group cannot trigger biometric sync (Status 403)', `Status: ${hybridAsViewerInApexSync.status}`);

    // 8. Admin Company Assignment & Real-Time Revocation
    console.log('\n--- 8. ADMIN USER CREATION, ASSIGNMENT & REAL-TIME REVOCATION ---');
    const testEmail = `test.viewer.${Date.now()}@hrms.local`;
    const createRes = await apiRequest('/hr-management', {
      method: 'POST',
      token: adminToken,
      body: {
        firstName: 'Test',
        lastName: 'Viewer',
        email: testEmail,
        password: 'password123',
        role: 'ATTENDANCE_VIEWER',
        assignments: [{ companyId: apexId, role: 'ATTENDANCE_VIEWER' }]
      }
    });
    assert(createRes.status === 200 || createRes.status === 201, '8.1 Admin creates new user with ATTENDANCE_VIEWER role assigned to Apex Group', `Status: ${createRes.status}`);

    const newUserId = createRes.data.data.id;

    // Log in as new viewer
    const newViewerLogin = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email: testEmail, password: 'password123' }
    });
    assert(newViewerLogin.status === 200, '8.2 Newly created Attendance Viewer can log in');
    const newViewerToken = newViewerLogin.data.data.token;

    // Can read attendance for Apex
    const newViewerRead = await apiRequest('/attendance', {
      token: newViewerToken,
      companyId: apexId
    });
    assert(newViewerRead.status === 200, '8.3 Newly created Attendance Viewer can read attendance for Apex Group');

    // Admin updates assignments to remove Apex Group (revocation)
    const revokeRes = await apiRequest(`/hr-management/${newUserId}/companies`, {
      method: 'PUT',
      token: adminToken,
      body: {
        assignments: [] // Remove all assignments
      }
    });
    assert(revokeRes.status === 200, '8.4 Admin revokes company assignment for the user');

    // Immediately after revocation, request to Apex is blocked with 403
    const revokedRead = await apiRequest('/attendance', {
      token: newViewerToken,
      companyId: apexId
    });
    assert(revokedRead.status === 403, '8.5 Real-time revocation: Immediately rejected with 403 Forbidden after assignment removal', `Status: ${revokedRead.status}`);

    // Cleanup test user
    await prisma.companyMembership.deleteMany({ where: { userId: newUserId } });
    await prisma.user.delete({ where: { id: newUserId } });
    console.log('Cleaned up ephemeral test user.');

    // 9. Admin and HR Existing Permissions Retained
    console.log('\n--- 9. ADMIN AND HR EXISTING FUNCTIONALITY VERIFICATION ---');
    const adminCompanyList = await apiRequest('/companies', { token: adminToken });
    assert(adminCompanyList.status === 200, '9.1 Admin retains full company management access');

    const adminHrUsers = await apiRequest('/hr-management', { token: adminToken });
    assert(adminHrUsers.status === 200, '9.2 Admin retains user management with company-specific assignment views');

    const hrLogin = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email: 'hr.apex@hrms.local', password: 'password123' }
    });
    assert(hrLogin.status === 200, '9.3 HR user can log in');
    const hrToken = hrLogin.data.data.token;

    const hrEmployees = await apiRequest('/employees', { token: hrToken, companyId: apexId });
    assert(hrEmployees.status === 200, '9.4 HR retains employee management permissions');

    const hrLeaves = await apiRequest('/leave/requests', { token: hrToken, companyId: apexId });
    assert(hrLeaves.status === 200, '9.5 HR retains leave management permissions');

    const hrCannotAdminCompanies = await apiRequest('/companies', { token: hrToken });
    assert(hrCannotAdminCompanies.status === 403, '9.6 HR cannot manage platform companies (retains strict boundaries)');

  } catch (err: any) {
    console.error('Fatal test error:', err);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n========================================================================');
  console.log(` VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runComprehensiveVerification();
