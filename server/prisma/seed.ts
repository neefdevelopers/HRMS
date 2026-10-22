import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding HRMS multi-brand database with realistic test dataset...');

  // Clear existing records in reverse order
  await prisma.salaryReceipt.deleteMany();
  await prisma.employeePayroll.deleteMany();
  await prisma.payrollPeriod.deleteMany();
  await prisma.payrollAdjustment.deleteMany();
  await prisma.incentive.deleteMany();
  await prisma.employeeSalaryConfig.deleteMany();
  await prisma.payrollAuditLog.deleteMany();
  await prisma.punchSyncLog.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.attendanceRegularization.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.punchRecord.deleteMany();
  await prisma.employeeDeviceMapping.deleteMany();
  await prisma.punchingDevice.deleteMany();
  await prisma.leaveBalance.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.leaveType.deleteMany();
  await prisma.holiday.deleteMany();
  await prisma.payrollSummary.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.employeeDocument.deleteMany();
  await prisma.exitRequest.deleteMany();
  await prisma.systemSetting.deleteMany();
  await prisma.companyMembership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.designation.deleteMany();
  await prisma.department.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.company.deleteMany();

  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Create Default Company
  const defaultCompany = await prisma.company.create({
    data: {
      name: 'Apex Group Enterprises',
      code: 'APEX_CORP',
      email: 'hq@apexgroup.com',
      phone: '+91 22 4500 0000',
      address: 'Apex Tower, Bandra Kurla Complex, Mumbai'
    }
  });

  // 2. Create Brands (directly under Company, no branches)
  const brandApex = await prisma.brand.create({
    data: {
      companyId: defaultCompany.id,
      name: 'Apex Retail Group',
      code: 'APEX',
      companyName: 'Apex Omnichannel Retail Enterprises Ltd.',
      email: 'contact@apexretail.com',
      phone: '+91 22 4500 1100',
      address: 'Apex Tower, Bandra Kurla Complex, Mumbai'
    }
  });

  const brandNexus = await prisma.brand.create({
    data: {
      companyId: defaultCompany.id,
      name: 'Nexus Logistics & Supply',
      code: 'NEXUS',
      companyName: 'Nexus Global Supply Chain Solutions Pvt. Ltd.',
      email: 'ops@nexuslogistics.com',
      phone: '+91 11 3900 2200',
      address: 'Nexus Logistics Park, Sector 18, Gurugram'
    }
  });

  const brandLumina = await prisma.brand.create({
    data: {
      companyId: defaultCompany.id,
      name: 'Lumina Hospitality',
      code: 'LUMINA',
      companyName: 'Lumina Hotels and Luxury Dining Ltd.',
      email: 'info@luminahospitality.com',
      phone: '+91 80 2800 3300',
      address: 'Lumina Grand Hotel, Residency Road, Bengaluru'
    }
  });

  // 3. Departments
  const deptHR = await prisma.department.create({
    data: { name: 'Human Resources', code: 'HR', brandId: brandApex.id }
  });
  const deptTech = await prisma.department.create({
    data: { name: 'Information Technology', code: 'IT', brandId: brandApex.id }
  });
  const deptSales = await prisma.department.create({
    data: { name: 'Sales & Marketing', code: 'SALES', brandId: brandApex.id }
  });

  const deptOpsNexus = await prisma.department.create({
    data: { name: 'Supply Chain Operations', code: 'OPS', brandId: brandNexus.id }
  });
  const deptFoodLumina = await prisma.department.create({
    data: { name: 'Food & Beverage Operations', code: 'FNB', brandId: brandLumina.id }
  });

  // 4. Designations
  const desigHRManager = await prisma.designation.create({
    data: { title: 'HR Manager', code: 'HRM', brandId: brandApex.id, departmentId: deptHR.id }
  });
  const desigDev = await prisma.designation.create({
    data: { title: 'Senior Software Engineer', code: 'SSE', brandId: brandApex.id, departmentId: deptTech.id }
  });
  const desigSalesLead = await prisma.designation.create({
    data: { title: 'Territory Sales Lead', code: 'TSL', brandId: brandApex.id, departmentId: deptSales.id }
  });
  const desigWarehouseMgr = await prisma.designation.create({
    data: { title: 'Warehouse Supervisor', code: 'WS', brandId: brandNexus.id, departmentId: deptOpsNexus.id }
  });
  const desigExecutiveChef = await prisma.designation.create({
    data: { title: 'Executive Sous Chef', code: 'ESC', brandId: brandLumina.id, departmentId: deptFoodLumina.id }
  });

  // 5. Standard Shifts
  const shiftGeneralApex = await prisma.shift.create({
    data: {
      name: 'General Corporate Shift (9 AM - 6 PM)',
      code: 'GEN-APEX',
      brandId: brandApex.id,
      startTime: '09:00',
      endTime: '18:00',
      gracePeriodMinutes: 15,
      isDefault: true
    }
  });

  const shiftOpsNexus = await prisma.shift.create({
    data: {
      name: 'Morning Warehouse Shift (8 AM - 5 PM)',
      code: 'OPS-NEXUS',
      brandId: brandNexus.id,
      startTime: '08:00',
      endTime: '17:00',
      gracePeriodMinutes: 10,
      isDefault: true
    }
  });

  const shiftLumina = await prisma.shift.create({
    data: {
      name: 'Hospitality Day Shift (10 AM - 7 PM)',
      code: 'DAY-LUMINA',
      brandId: brandLumina.id,
      startTime: '10:00',
      endTime: '19:00',
      gracePeriodMinutes: 15,
      isDefault: true
    }
  });

  // 6. Leave Types
  const leaveCasualApex = await prisma.leaveType.create({
    data: { name: 'Casual Leave', code: 'CL', brandId: brandApex.id, daysPerYear: 12 }
  });
  const leaveSickApex = await prisma.leaveType.create({
    data: { name: 'Sick Leave', code: 'SL', brandId: brandApex.id, daysPerYear: 10 }
  });
  const leaveEarnedApex = await prisma.leaveType.create({
    data: { name: 'Earned / Privilege Leave', code: 'EL', brandId: brandApex.id, daysPerYear: 15, carryForward: true }
  });

  await prisma.leaveType.create({
    data: { name: 'Annual Paid Leave', code: 'AL-NEXUS', brandId: brandNexus.id, daysPerYear: 18 }
  });

  // 7. Punching Devices
  const dev1 = await prisma.punchingDevice.create({
    data: {
      deviceName: 'Apex Bandra HQ Biometric Scanner',
      serialNumber: 'BIO-APEX-001',
      ipAddress: '192.168.10.45',
      location: 'Turnstile A, Main Entrance',
      brandId: brandApex.id,
      status: 'ONLINE',
      lastHeartbeat: new Date()
    }
  });

  // 8. Employees
  // Apex employees
  const empManagerApex = await prisma.employee.create({
    data: {
      employeeId: 'APEX-1001',
      brandId: brandApex.id,
      departmentId: deptHR.id,
      designationId: desigHRManager.id,
      shiftId: shiftGeneralApex.id,
      firstName: 'Priya',
      lastName: 'Sharma',
      email: 'priya.sharma@apexretail.com',
      phone: '+91 98200 11223',
      dateOfBirth: '1989-10-14', // Birthday in 2 days!
      joiningDate: '2022-01-15',
      employeeStatus: 'ACTIVE',
      biometricId: 'BIO-1001',
      monthlySalary: 65000.0
    }
  });

  const empDev1 = await prisma.employee.create({
    data: {
      employeeId: 'APEX-1002',
      brandId: brandApex.id,
      departmentId: deptTech.id,
      designationId: desigDev.id,
      shiftId: shiftGeneralApex.id,
      reportingManagerId: empManagerApex.id,
      firstName: 'Arjun',
      lastName: 'Mehta',
      email: 'arjun.mehta@apexretail.com',
      phone: '+91 98200 44556',
      dateOfBirth: '1994-10-12', // Birthday TODAY!
      joiningDate: '2023-04-01',
      employeeStatus: 'ACTIVE',
      biometricId: 'BIO-1002',
      monthlySalary: 45000.0
    }
  });

  const empSales1 = await prisma.employee.create({
    data: {
      employeeId: 'APEX-1003',
      brandId: brandApex.id,
      departmentId: deptSales.id,
      designationId: desigSalesLead.id,
      shiftId: shiftGeneralApex.id,
      reportingManagerId: empManagerApex.id,
      firstName: 'Rohan',
      lastName: 'Verma',
      email: 'rohan.verma@apexretail.com',
      phone: '+91 98200 77889',
      dateOfBirth: '1996-03-22',
      joiningDate: '2026-10-05', // New joiner this week!
      employeeStatus: 'ACTIVE',
      biometricId: 'BIO-1003',
      monthlySalary: 50000.0
    }
  });

  const empDev2 = await prisma.employee.create({
    data: {
      employeeId: 'APEX-1004',
      brandId: brandApex.id,
      departmentId: deptTech.id,
      designationId: desigDev.id,
      shiftId: shiftGeneralApex.id,
      reportingManagerId: empManagerApex.id,
      firstName: 'Ananya',
      lastName: 'Iyer',
      email: 'ananya.iyer@apexretail.com',
      phone: '+91 98200 99001',
      dateOfBirth: '1995-10-16', // Upcoming birthday in 4 days!
      joiningDate: '2026-10-01', // New joiner this month!
      employeeStatus: 'ACTIVE',
      biometricId: 'BIO-1004',
      monthlySalary: 42000.0
    }
  });

  // Nexus employee
  const empNexus1 = await prisma.employee.create({
    data: {
      employeeId: 'NEXUS-2001',
      brandId: brandNexus.id,
      departmentId: deptOpsNexus.id,
      designationId: desigWarehouseMgr.id,
      shiftId: shiftOpsNexus.id,
      firstName: 'Vikram',
      lastName: 'Singh',
      email: 'vikram.singh@nexuslogistics.com',
      phone: '+91 98111 22334',
      dateOfBirth: '1987-05-19',
      joiningDate: '2021-08-10',
      employeeStatus: 'ACTIVE',
      biometricId: 'BIO-2001',
      monthlySalary: 38000.0
    }
  });

  // Lumina employee
  const empLumina1 = await prisma.employee.create({
    data: {
      employeeId: 'LUMINA-3001',
      brandId: brandLumina.id,
      departmentId: deptFoodLumina.id,
      designationId: desigExecutiveChef.id,
      shiftId: shiftLumina.id,
      firstName: 'Kavita',
      lastName: 'Patel',
      email: 'kavita.patel@luminahospitality.com',
      phone: '+91 98450 33445',
      dateOfBirth: '1991-11-03',
      joiningDate: '2022-11-01',
      employeeStatus: 'ACTIVE',
      biometricId: 'BIO-3001',
      monthlySalary: 55000.0
    }
  });

  // 9. Users (Only 2 Roles: ADMIN and HR)
  // Admin
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@hrms.local',
      passwordHash,
      role: 'ADMIN',
      firstName: 'Platform',
      lastName: 'Admin',
      companyId: defaultCompany.id
    }
  });

  // HR (Company A only)
  const hrApexUser = await prisma.user.create({
    data: {
      email: 'hr.apex@hrms.local',
      passwordHash,
      role: 'HR',
      firstName: 'Apex',
      lastName: 'HR',
      companyId: defaultCompany.id,
      brandId: brandApex.id
    }
  });

  // Multi-Company HR (Assigned to multiple companies)
  const hrMultiUser = await prisma.user.create({
    data: {
      email: 'hr.multi@hrms.local',
      passwordHash,
      role: 'HR',
      firstName: 'Morgan',
      lastName: 'Multi-HR',
      companyId: defaultCompany.id
    }
  });

  // Unassigned HR (0 company assignments)
  const hrUnassignedUser = await prisma.user.create({
    data: {
      email: 'hr.unassigned@hrms.local',
      passwordHash,
      role: 'HR',
      firstName: 'Alex',
      lastName: 'Unassigned'
    }
  });

  // Create memberships
  await prisma.companyMembership.createMany({
    data: [
      { userId: adminUser.id, companyId: defaultCompany.id, role: 'ADMIN' },
      { userId: hrApexUser.id, companyId: defaultCompany.id, role: 'HR' },
      { userId: hrMultiUser.id, companyId: defaultCompany.id, role: 'HR' }
    ]
  });

  // 10. Leave Requests & Balances
  const todayStr = new Date().toISOString().split('T')[0];

  // Leave Request for Ananya (On Leave today)
  const leaveReqAnanya = await prisma.leaveRequest.create({
    data: {
      employeeId: empDev2.id,
      leaveTypeId: leaveCasualApex.id,
      brandId: brandApex.id,
      startDate: todayStr,
      endDate: todayStr,
      reason: 'Family urgent commitment',
      status: 'APPROVED',
      reviewedAt: new Date()
    }
  });

  // Pending Leave Request for Rohan (Waiting for approval)
  const pendingLeaveRohan = await prisma.leaveRequest.create({
    data: {
      employeeId: empSales1.id,
      leaveTypeId: leaveSickApex.id,
      brandId: brandApex.id,
      startDate: '2026-10-18',
      endDate: '2026-10-19',
      reason: 'Medical consultation & recovery',
      status: 'PENDING'
    }
  });

  await prisma.approval.create({
    data: {
      type: 'LEAVE',
      referenceId: pendingLeaveRohan.id,
      brandId: brandApex.id,
      requesterId: empSales1.id,
      status: 'PENDING'
    }
  });

  // 11. Punch Records & Attendance Records
  // Priya: Present on time (Check in: 08:55)
  const priyaCheckIn = new Date(`${todayStr}T08:55:00Z`);
  const priyaCheckOut = new Date(`${todayStr}T18:05:00Z`);
  await prisma.punchRecord.create({
    data: {
      biometricId: 'BIO-1001',
      employeeId: empManagerApex.id,
      brandId: brandApex.id,
      deviceId: dev1.id,
      punchTime: priyaCheckIn,
      punchType: 'CHECK_IN'
    }
  });
  await prisma.attendance.create({
    data: {
      employeeId: empManagerApex.id,
      brandId: brandApex.id,
      shiftId: shiftGeneralApex.id,
      date: todayStr,
      checkIn: priyaCheckIn,
      checkOut: priyaCheckOut,
      workingHours: 9.1,
      status: 'PRESENT',
      lateMinutes: 0
    }
  });

  // Arjun: Late arrival (Shift starts 09:00 + 15m grace -> Checked in at 09:32, late by 32 min)
  const arjunCheckIn = new Date(`${todayStr}T09:32:00Z`);
  await prisma.punchRecord.create({
    data: {
      biometricId: 'BIO-1002',
      employeeId: empDev1.id,
      brandId: brandApex.id,
      deviceId: dev1.id,
      punchTime: arjunCheckIn,
      punchType: 'CHECK_IN'
    }
  });
  await prisma.attendance.create({
    data: {
      employeeId: empDev1.id,
      brandId: brandApex.id,
      shiftId: shiftGeneralApex.id,
      date: todayStr,
      checkIn: arjunCheckIn,
      workingHours: 4.5,
      status: 'LATE',
      lateMinutes: 32
    }
  });

  // Ananya: On approved leave today
  await prisma.attendance.create({
    data: {
      employeeId: empDev2.id,
      brandId: brandApex.id,
      shiftId: shiftGeneralApex.id,
      date: todayStr,
      status: 'ON_LEAVE',
      remarks: 'Approved Casual Leave'
    }
  });

  // Vikram (Nexus): Present
  const vikramCheckIn = new Date(`${todayStr}T07:55:00Z`);
  await prisma.attendance.create({
    data: {
      employeeId: empNexus1.id,
      brandId: brandNexus.id,
      shiftId: shiftOpsNexus.id,
      date: todayStr,
      checkIn: vikramCheckIn,
      workingHours: 8.0,
      status: 'PRESENT'
    }
  });

  // 13. Employee Salary Configurations
  await prisma.employeeSalaryConfig.create({
    data: {
      employeeId: empManagerApex.id,
      brandId: brandApex.id,
      monthlySalary: 65000.0,
      standardWorkingDays: 26,
      standardWorkingHoursPerDay: 8.0,
      effectiveFrom: '2026-01-01',
      otCalculationMethod: 'STANDARD_HOURLY',
      incompleteHoursDeductionMethod: 'STANDARD_HOURLY',
      status: 'ACTIVE'
    }
  });

  await prisma.employeeSalaryConfig.create({
    data: {
      employeeId: empDev1.id,
      brandId: brandApex.id,
      monthlySalary: 45000.0,
      standardWorkingDays: 26,
      standardWorkingHoursPerDay: 8.0,
      effectiveFrom: '2026-01-01',
      otCalculationMethod: 'CUSTOM_RATE',
      otRatePerHour: 250.0,
      incompleteHoursDeductionMethod: 'STANDARD_HOURLY',
      status: 'ACTIVE'
    }
  });

  await prisma.employeeSalaryConfig.create({
    data: {
      employeeId: empSales1.id,
      brandId: brandApex.id,
      monthlySalary: 50000.0,
      standardWorkingDays: 26,
      standardWorkingHoursPerDay: 8.0,
      effectiveFrom: '2026-01-01',
      otCalculationMethod: 'STANDARD_HOURLY',
      incompleteHoursDeductionMethod: 'STANDARD_HOURLY',
      status: 'ACTIVE'
    }
  });

  await prisma.employeeSalaryConfig.create({
    data: {
      employeeId: empDev2.id,
      brandId: brandApex.id,
      monthlySalary: 42000.0,
      standardWorkingDays: 26,
      standardWorkingHoursPerDay: 8.0,
      effectiveFrom: '2026-10-01',
      otCalculationMethod: 'STANDARD_HOURLY',
      incompleteHoursDeductionMethod: 'STANDARD_HOURLY',
      status: 'ACTIVE'
    }
  });

  await prisma.employeeSalaryConfig.create({
    data: {
      employeeId: empNexus1.id,
      brandId: brandNexus.id,
      monthlySalary: 38000.0,
      standardWorkingDays: 26,
      standardWorkingHoursPerDay: 8.0,
      effectiveFrom: '2026-01-01',
      otCalculationMethod: 'STANDARD_HOURLY',
      incompleteHoursDeductionMethod: 'STANDARD_HOURLY',
      status: 'ACTIVE'
    }
  });

  await prisma.employeeSalaryConfig.create({
    data: {
      employeeId: empLumina1.id,
      brandId: brandLumina.id,
      monthlySalary: 55000.0,
      standardWorkingDays: 26,
      standardWorkingHoursPerDay: 8.0,
      effectiveFrom: '2026-01-01',
      otCalculationMethod: 'STANDARD_HOURLY',
      incompleteHoursDeductionMethod: 'STANDARD_HOURLY',
      status: 'ACTIVE'
    }
  });

  // 14. Sample Incentives
  await prisma.incentive.create({
    data: {
      employeeId: empDev1.id,
      brandId: brandApex.id,
      payrollMonth: '2026-10',
      title: 'Q3 Performance Excellence',
      amount: 2500.0,
      incentiveType: 'FIXED',
      calculatedAmount: 2500.0,
      reason: 'Delivered customer analytics sprint ahead of deadline',
      status: 'APPROVED'
    }
  });

  await prisma.incentive.create({
    data: {
      employeeId: empSales1.id,
      brandId: brandApex.id,
      payrollMonth: '2026-10',
      title: 'Sales Target Super-achiever Bonus',
      amount: 5.0,
      incentiveType: 'PERCENTAGE',
      calculationBase: 'FIXED_SALARY',
      calculatedAmount: 2500.0,
      reason: 'Exceeded regional sales target by 130%',
      status: 'APPROVED'
    }
  });

  await prisma.incentive.create({
    data: {
      employeeId: empNexus1.id,
      brandId: brandNexus.id,
      payrollMonth: '2026-10',
      title: 'Logistics Safety Compliance Bonus',
      amount: 1500.0,
      incentiveType: 'FIXED',
      calculatedAmount: 1500.0,
      reason: 'Zero incidents in warehouse logistics',
      status: 'PENDING'
    }
  });

  // 15. Finalized September 2026 Payroll Period & Receipts
  const periodSepApex = await prisma.payrollPeriod.create({
    data: {
      brandId: brandApex.id,
      period: '2026-09',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      status: 'FINALIZED',
      finalizedAt: new Date('2026-10-01T10:00:00Z')
    }
  });

  const payrollArjunSep = await prisma.employeePayroll.create({
    data: {
      payrollPeriodId: periodSepApex.id,
      employeeId: empDev1.id,
      brandId: brandApex.id,
      currency: 'INR',
      baseSalary: 45000.0,
      payableSalary: 45000.0,
      standardWorkingDays: 26,
      standardWorkingHoursPerDay: 8.0,
      payableWorkingHours: 208.0,
      eligibleWorkingHours: 216.0,
      approvedOtHours: 8.0,
      otRate: 250.0,
      otPayment: 2000.0,
      incompleteHours: 0.0,
      incompleteDeductionRate: 216.35,
      incompleteDeductionAmount: 0.0,
      approvedIncentivesAmount: 2500.0,
      additionalEarnings: 0.0,
      otherDeductions: 0.0,
      grossEarnings: 49500.0,
      totalDeductions: 0.0,
      netSalary: 49500.0,
      status: 'FINALIZED',
      presentDaysCount: 26,
      leaveDaysCount: 0,
      absentDaysCount: 0,
      finalizedAt: new Date('2026-10-01T10:00:00Z')
    }
  });

  await prisma.salaryReceipt.create({
    data: {
      employeePayrollId: payrollArjunSep.id,
      receiptNumber: 'REC-APEX-202609-APEX1002',
      issueDate: '2026-10-01',
      paymentDate: '2026-10-01',
      netSalary: 49500.0,
      amountInWords: 'Forty Nine Thousand Five Hundred Rupees Only',
      snapshotJson: JSON.stringify({
        receiptNumber: 'REC-APEX-202609-APEX1002',
        issueDate: '2026-10-01',
        paymentDate: '2026-10-01',
        payrollPeriod: '2026-09',
        companyName: brandApex.companyName,
        brandName: brandApex.name,
        brandAddress: brandApex.address,
        brandPhone: brandApex.phone,
        brandEmail: brandApex.email,
        employeeName: 'Arjun Mehta',
        employeeId: 'APEX-1002',
        department: 'Engineering & Technology',
        designation: 'Software Development Engineer',
        joiningDate: '2023-04-01',
        currency: 'INR',
        baseSalary: 45000.0,
        payableSalary: 45000.0,
        isProrated: false,
        approvedOtHours: 8.0,
        otRate: 250.0,
        otPayment: 2000.0,
        approvedIncentivesAmount: 2500.0,
        additionalEarnings: 0.0,
        grossEarnings: 49500.0,
        incompleteHours: 0.0,
        incompleteDeductionRate: 216.35,
        incompleteDeductionAmount: 0.0,
        otherDeductions: 0.0,
        totalDeductions: 0.0,
        netSalary: 49500.0,
        amountInWords: 'Forty Nine Thousand Five Hundred Rupees Only',
        presentDaysCount: 26,
        leaveDaysCount: 0,
        absentDaysCount: 0,
        eligibleWorkingHours: 216.0,
        payableWorkingHours: 208.0
      })
    }
  });

  console.log('Seed completed successfully!');
  console.log('Demo Credentials (2 Retained Roles: ADMIN and HR):');
  console.log('- Admin:            admin@hrms.local         / password123');
  console.log('- HR (Company A):   hr.apex@hrms.local       / password123');
  console.log('- HR (Multi-Comp):  hr.multi@hrms.local      / password123');
  console.log('- HR (Unassigned):  hr.unassigned@hrms.local / password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
