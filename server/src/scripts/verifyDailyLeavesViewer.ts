import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5000/api';

async function runDailyLeaveVerification() {
  console.log('========================================================================');
  console.log(' DAILY EMPLOYEE LEAVE FOR ATTENDANCE_VIEWER VERIFICATION SUITE');
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

  let createdLeaveId: string | null = null;
  let createdPendingLeaveId: string | null = null;

  try {
    // Retrieve companies
    const apexComp = await prisma.company.findUnique({ where: { code: 'APEX_CORP' } });
    const betaComp = await prisma.company.findUnique({ where: { code: 'BETA_CORP' } });
    assert(!!apexComp && !!betaComp, '1. Companies Apex and Beta exist');
    const apexId = apexComp!.id;
    const betaId = betaComp!.id;

    // Retrieve active employees and leave types
    const apexEmployee = await prisma.employee.findFirst({
      where: { companyId: apexId, employeeStatus: 'ACTIVE' },
      include: { brand: true }
    });
    const betaEmployee = await prisma.employee.findFirst({
      where: { companyId: betaId, employeeStatus: 'ACTIVE' },
      include: { brand: true }
    });
    assert(!!apexEmployee && !!betaEmployee, '2. Active employees found in both Apex and Beta companies');

    const apexLeaveType = await prisma.leaveType.findFirst({
      where: { brandId: apexEmployee!.brandId }
    });
    assert(!!apexLeaveType, '3. Leave type exists for Apex employee brand');

    // Login accounts
    const hrLogin = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email: 'hr.apex@hrms.local', password: 'password123' }
    });
    assert(hrLogin.status === 200, '4. HR logs in successfully');
    const hrToken = hrLogin.data.data.token;

    const viewerBLogin = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email: 'viewer.b@hrms.local', password: 'password123' }
    });
    assert(viewerBLogin.status === 200, '5. Viewer B (Apex) logs in successfully');
    const viewerBToken = viewerBLogin.data.data.token;

    const viewerALogin = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email: 'viewer.a@hrms.local', password: 'password123' }
    });
    assert(viewerALogin.status === 200, '6. Viewer A (Beta) logs in successfully');
    const viewerAToken = viewerALogin.data.data.token;

    // Test Dates (multi-day)
    const testDate1 = '2026-11-10';
    const testDate2 = '2026-11-11';
    const testDate3 = '2026-11-12';

    // 1. HR creates an APPROVED multi-day leave for apexEmployee
    console.log('\n--- TEST A: HR CREATES & APPROVES MULTI-DAY LEAVE ---');
    const createLeaveRes = await apiRequest('/leave/apply', {
      method: 'POST',
      token: hrToken,
      companyId: apexId,
      body: {
        employeeId: apexEmployee!.id,
        leaveTypeId: apexLeaveType!.id,
        startDate: testDate1,
        endDate: testDate3,
        isHalfDay: false,
        reason: 'Annual medical wellness checkup'
      }
    });
    assert(createLeaveRes.status === 201, 'A.1 HR records multi-day leave request from 2026-11-10 to 2026-11-12');
    createdLeaveId = createLeaveRes.data.data.id;

    // 2. Attendance Viewer B reads daily leaves for testDate1, testDate2, testDate3
    console.log('\n--- TEST B: ATTENDANCE_VIEWER READS DAILY LEAVES ---');
    const viewerReadDay1 = await apiRequest(`/attendance/daily-leaves?date=${testDate1}`, {
      token: viewerBToken,
      companyId: apexId
    });
    assert(viewerReadDay1.status === 200, 'B.1 Viewer B successfully calls /attendance/daily-leaves for Day 1');
    assert(viewerReadDay1.data.data.summary.totalApproved >= 1, 'B.2 Summary shows approved employee on leave for Day 1');
    const foundOnDay1 = viewerReadDay1.data.data.leaves.some((l: any) => l.id === createdLeaveId && l.status === 'APPROVED');
    assert(foundOnDay1, 'B.3 Multi-day leave record appears on Day 1 (2026-11-10)');

    const viewerReadDay2 = await apiRequest(`/attendance/daily-leaves?date=${testDate2}`, {
      token: viewerBToken,
      companyId: apexId
    });
    const foundOnDay2 = viewerReadDay2.data.data.leaves.some((l: any) => l.id === createdLeaveId && l.status === 'APPROVED');
    assert(foundOnDay2, 'B.4 Multi-day leave record appears on Day 2 (2026-11-11)');

    const viewerReadDay3 = await apiRequest(`/attendance/daily-leaves?date=${testDate3}`, {
      token: viewerBToken,
      companyId: apexId
    });
    const foundOnDay3 = viewerReadDay3.data.data.leaves.some((l: any) => l.id === createdLeaveId && l.status === 'APPROVED');
    assert(foundOnDay3, 'B.5 Multi-day leave record appears on Day 3 (2026-11-12)');

    // Verify fields returned do not leak sensitive details
    const sampleRecord = viewerReadDay1.data.data.leaves.find((l: any) => l.id === createdLeaveId);
    assert(
      !!sampleRecord.employee.employeeId &&
      !!sampleRecord.employee.firstName &&
      !!sampleRecord.leaveType.name &&
      !('salary' in sampleRecord.employee) &&
      !('bankDetails' in sampleRecord.employee),
      'B.6 Returned leave record contains necessary employee identifiers without leaking salary or personal bank details'
    );

    // 3. Attendance register displays ON_LEAVE
    console.log('\n--- TEST C: ATTENDANCE REGISTER REFLECTS APPROVED LEAVE ---');
    const attRes = await apiRequest(`/attendance?date=${testDate1}`, {
      token: viewerBToken,
      companyId: apexId
    });
    assert(attRes.status === 200, 'C.1 Attendance records fetched for Day 1');
    const empAttRecord = attRes.data.data.find((a: any) => a.employeeId === apexEmployee!.id);
    assert(
      empAttRecord && empAttRecord.status === 'ON_LEAVE',
      'C.2 Attendance record for employee displays ON_LEAVE rather than ordinary ABSENT'
    );

    // 4. Test Pending Leave Behavior
    console.log('\n--- TEST D: PENDING LEAVES ACCURATELY DISPLAYED BUT NOT MARKED APPROVED ---');
    const pendingDate = '2026-11-20';
    // Create directly in DB as PENDING without updating attendance
    const pendingLeave = await prisma.leaveRequest.create({
      data: {
        companyId: apexId,
        employeeId: apexEmployee!.id,
        leaveTypeId: apexLeaveType!.id,
        brandId: apexEmployee!.brandId,
        startDate: pendingDate,
        endDate: pendingDate,
        isHalfDay: false,
        reason: 'Pending travel request',
        status: 'PENDING'
      }
    });
    createdPendingLeaveId = pendingLeave.id;

    const viewerPendingCheck = await apiRequest(`/attendance/daily-leaves?date=${pendingDate}`, {
      token: viewerBToken,
      companyId: apexId
    });
    assert(viewerPendingCheck.status === 200, 'D.1 Viewer queries daily leaves for date with pending request');
    assert(viewerPendingCheck.data.data.summary.totalPending >= 1, 'D.2 Summary accurately counts pending request under totalPending');
    const pendingItem = viewerPendingCheck.data.data.leaves.find((l: any) => l.id === pendingLeave.id);
    assert(pendingItem && pendingItem.status === 'PENDING', 'D.3 Pending leave is displayed with PENDING status');

    // Verify pending leave is NOT treated as approved leave in attendance register
    const pendingAttCheck = await apiRequest(`/attendance?date=${pendingDate}`, {
      token: viewerBToken,
      companyId: apexId
    });
    const pendingAttRecord = pendingAttCheck.data.data.find((a: any) => a.employeeId === apexEmployee!.id);
    assert(
      !pendingAttRecord || pendingAttRecord.status !== 'ON_LEAVE',
      'D.4 Pending request is NOT treated as approved leave in attendance register'
    );

    // 5. Attendance Viewer CANNOT modify or approve leave
    console.log('\n--- TEST E: ATTENDANCE_VIEWER FORBIDDEN ACTIONS & LEAVE MODULE DENIAL ---');
    const viewerApplyAttempt = await apiRequest('/leave/apply', {
      method: 'POST',
      token: viewerBToken,
      companyId: apexId,
      body: {
        employeeId: apexEmployee!.id,
        leaveTypeId: apexLeaveType!.id,
        startDate: '2026-11-25',
        endDate: '2026-11-25',
        reason: 'Attempted viewer leave creation'
      }
    });
    assert(viewerApplyAttempt.status === 403, 'E.1 Attendance Viewer is blocked with 403 Forbidden when attempting to apply leave');

    const viewerReviewAttempt = await apiRequest(`/leave/requests/${createdLeaveId}/review`, {
      method: 'POST',
      token: viewerBToken,
      companyId: apexId,
      body: { status: 'REJECTED' }
    });
    assert(viewerReviewAttempt.status === 403, 'E.2 Attendance Viewer is blocked with 403 Forbidden when attempting to review/approve/reject leave');

    const viewerDeleteAttempt = await apiRequest(`/leave/${createdLeaveId}`, {
      method: 'DELETE',
      token: viewerBToken,
      companyId: apexId
    });
    assert(viewerDeleteAttempt.status === 403, 'E.3 Attendance Viewer is blocked with 403 Forbidden when attempting to delete leave');

    const viewerLeaveRequestsAttempt = await apiRequest('/leave/requests', {
      token: viewerBToken,
      companyId: apexId
    });
    assert(viewerLeaveRequestsAttempt.status === 403, 'E.4 Attendance Viewer is blocked with 403 Forbidden from full Leave Management list /leave/requests');

    // 6. Company Isolation
    console.log('\n--- TEST F: COMPANY ISOLATION ---');
    // Viewer A is assigned to Beta Logistics, NOT Apex Group
    const viewerACrossCompany = await apiRequest(`/attendance/daily-leaves?date=${testDate1}`, {
      token: viewerAToken,
      companyId: apexId // Unassigned company
    });
    assert(viewerACrossCompany.status === 403, 'F.1 Viewer A (Beta) is rejected with 403 Forbidden when accessing Company A daily-leaves');

    // When Viewer A queries their own company (Beta), they do NOT see Company A's leave records
    const viewerAOwnCompany = await apiRequest(`/attendance/daily-leaves?date=${testDate1}`, {
      token: viewerAToken,
      companyId: betaId
    });
    assert(viewerAOwnCompany.status === 200, 'F.2 Viewer A can read daily leaves for Beta Logistics');
    const leakedFromA = viewerAOwnCompany.data.data.leaves.some((l: any) => l.id === createdLeaveId);
    assert(!leakedFromA, 'F.3 Company A leave records are completely isolated and NEVER leak to Company B');

  } catch (err: any) {
    console.error('Fatal verification error:', err);
    failed++;
  } finally {
    // Cleanup created test records
    if (createdLeaveId) {
      await prisma.attendance.deleteMany({
        where: { date: { in: ['2026-11-10', '2026-11-11', '2026-11-12'] }, status: 'ON_LEAVE' }
      }).catch(() => null);
      await prisma.leaveRequest.delete({ where: { id: createdLeaveId } }).catch(() => null);
    }
    if (createdPendingLeaveId) {
      await prisma.leaveRequest.delete({ where: { id: createdPendingLeaveId } }).catch(() => null);
    }
    await prisma.$disconnect();
  }

  console.log('\n========================================================================');
  console.log(` VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) process.exit(1);
}

runDailyLeaveVerification();
