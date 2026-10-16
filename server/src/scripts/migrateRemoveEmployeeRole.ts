import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting Safe Role Removal Migration ---');

  // 1. Inspect existing accounts with obsolete roles
  const obsoleteUsers = await prisma.user.findMany({
    where: {
      role: { in: ['EMPLOYEE', 'MANAGER'] }
    },
    include: {
      memberships: true,
      employee: true
    }
  });

  console.log(`Found ${obsoleteUsers.length} user accounts with removed roles (EMPLOYEE/MANAGER):`);
  for (const u of obsoleteUsers) {
    console.log(` - User ID: ${u.id}, Email: ${u.email}, Role: ${u.role}, Linked Employee: ${u.employee ? `${u.employee.firstName} ${u.employee.lastName} (${u.employee.employeeId})` : 'None'}`);
  }

  // 2. Quarantine/Disable obsolete user login accounts
  for (const u of obsoleteUsers) {
    await prisma.user.update({
      where: { id: u.id },
      data: {
        isActive: false
      }
    });
    console.log(` Quarantined user login account: ${u.email} (isActive: false)`);
  }

  // 3. Disable obsolete company memberships
  const obsoleteMemberships = await prisma.companyMembership.findMany({
    where: {
      role: { in: ['EMPLOYEE', 'MANAGER'] }
    }
  });

  console.log(`Found ${obsoleteMemberships.length} memberships with removed roles:`);
  for (const m of obsoleteMemberships) {
    await prisma.companyMembership.update({
      where: { id: m.id },
      data: {
        isActive: false
      }
    });
    console.log(` Deactivated company membership ID: ${m.id}`);
  }

  // 4. Verification: Verify employee business records remain intact
  const employeeCount = await prisma.employee.count();
  const activeEmployeeCount = await prisma.employee.count({ where: { employeeStatus: 'ACTIVE' } });
  const attendanceCount = await prisma.attendance.count();
  const leaveCount = await prisma.leaveRequest.count();
  const payrollCount = await prisma.employeePayroll.count();
  const assetCount = await prisma.asset.count();
  const exitCount = await prisma.exitRequest.count();

  console.log('\n--- Business Entities Verification ---');
  console.log(`Total Employees in HRMS: ${employeeCount} (Active: ${activeEmployeeCount})`);
  console.log(`Total Attendance records: ${attendanceCount}`);
  console.log(`Total Leave records: ${leaveCount}`);
  console.log(`Total Payroll records: ${payrollCount}`);
  console.log(`Total Assets: ${assetCount}`);
  console.log(`Total Exit requests: ${exitCount}`);

  // Verify only authorized roles remain active
  const activeUsers = await prisma.user.findMany({
    where: { isActive: true },
    select: { email: true, role: true }
  });
  console.log('\n--- Remaining Active User Logins ---');
  for (const au of activeUsers) {
    console.log(` - ${au.email} (${au.role})`);
  }

  console.log('\n--- Safe Role Removal Migration Complete ---');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
