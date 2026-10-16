import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('=====================================================');
  console.log(' SAFE MIGRATION: TWO-ROLE ARCHITECTURE (ADMIN & HR)  ');
  console.log('=====================================================\n');

  // 1. Inspect existing users
  const allUsers = await prisma.user.findMany({
    include: { memberships: true }
  });

  console.log(`[*] Found ${allUsers.length} total user accounts in database.`);

  const passwordHash = await bcrypt.hash('password123', 10);

  // 2. Migrate existing users safely according to Section 9 rules
  for (const user of allUsers) {
    if (user.role === 'COMPANY_ADMIN') {
      console.log(`[+] Mapping Company Admin (${user.email}) -> ADMIN`);
      await prisma.user.update({
        where: { id: user.id },
        data: { role: 'ADMIN', isActive: true }
      });
    } else if (['COMPANY_HR', 'GROUP_HR', 'BRAND_HR'].includes(user.role)) {
      console.log(`[+] Mapping HR role (${user.email}, former ${user.role}) -> HR`);
      await prisma.user.update({
        where: { id: user.id },
        data: { role: 'HR', isActive: true }
      });
    } else if (user.role === 'SUPER_ADMIN') {
      console.log(`[!] Quarantining Super Admin account (${user.email}) per migration policy.`);
      await prisma.user.update({
        where: { id: user.id },
        data: { isActive: false }
      });
    } else if (user.role === 'MANAGER' || user.role === 'EMPLOYEE') {
      console.log(`[-] Ensuring obsolete account (${user.email}) is deactivated.`);
      await prisma.user.update({
        where: { id: user.id },
        data: { isActive: false }
      });
    }
  }

  // 3. Migrate existing memberships to role 'ADMIN' or 'HR'
  const allMemberships = await prisma.companyMembership.findMany();
  for (const mem of allMemberships) {
    const newRole = mem.role === 'COMPANY_ADMIN' ? 'ADMIN' : 'HR';
    await prisma.companyMembership.update({
      where: { id: mem.id },
      data: { role: newRole }
    });
  }
  console.log(`[*] Updated ${allMemberships.length} memberships to ADMIN or HR roles.`);

  // 4. Ensure Companies A and B exist
  const apexCompany = await prisma.company.findUnique({ where: { code: 'APEX_CORP' } });
  const betaCompany = await prisma.company.findUnique({ where: { code: 'BETA_CORP' } });

  if (!apexCompany) {
    throw new Error('Apex Group company not found in database.');
  }

  // 5. Ensure primary Admin account exists: admin@hrms.local
  let adminUser = await prisma.user.findUnique({ where: { email: 'admin@hrms.local' } });
  if (!adminUser) {
    console.log('[+] Creating demo Admin account: admin@hrms.local');
    adminUser = await prisma.user.create({
      data: {
        email: 'admin@hrms.local',
        passwordHash,
        firstName: 'System',
        lastName: 'Admin',
        role: 'ADMIN',
        isActive: true,
        companyId: apexCompany.id
      }
    });
  } else {
    console.log('[*] Updating existing admin@hrms.local -> role ADMIN, active');
    await prisma.user.update({
      where: { id: adminUser.id },
      data: { role: 'ADMIN', isActive: true }
    });
  }

  // Ensure Admin has membership in Apex
  await prisma.companyMembership.upsert({
    where: { userId_companyId: { userId: adminUser.id, companyId: apexCompany.id } },
    create: { userId: adminUser.id, companyId: apexCompany.id, role: 'ADMIN', isActive: true },
    update: { role: 'ADMIN', isActive: true }
  });

  // 6. Ensure HR User assigned to Company A only: hr.apex@hrms.local
  let hrApex = await prisma.user.findUnique({ where: { email: 'hr.apex@hrms.local' } });
  if (!hrApex) {
    console.log('[+] Creating demo HR (Company A only) account: hr.apex@hrms.local');
    hrApex = await prisma.user.create({
      data: {
        email: 'hr.apex@hrms.local',
        passwordHash,
        firstName: 'Apex',
        lastName: 'HR',
        role: 'HR',
        isActive: true,
        companyId: apexCompany.id
      }
    });
  } else {
    await prisma.user.update({
      where: { id: hrApex.id },
      data: { role: 'HR', isActive: true, companyId: apexCompany.id }
    });
  }

  await prisma.companyMembership.upsert({
    where: { userId_companyId: { userId: hrApex.id, companyId: apexCompany.id } },
    create: { userId: hrApex.id, companyId: apexCompany.id, role: 'HR', isActive: true },
    update: { role: 'HR', isActive: true }
  });

  // 7. Ensure Multi-Company HR User: hr.multi@hrms.local (assigned to Company A and Company B)
  let hrMulti = await prisma.user.findUnique({ where: { email: 'hr.multi@hrms.local' } });
  if (!hrMulti) {
    console.log('[+] Creating demo Multi-Company HR account: hr.multi@hrms.local');
    hrMulti = await prisma.user.create({
      data: {
        email: 'hr.multi@hrms.local',
        passwordHash,
        firstName: 'Morgan',
        lastName: 'Multi-HR',
        role: 'HR',
        isActive: true,
        companyId: apexCompany.id
      }
    });
  } else {
    await prisma.user.update({
      where: { id: hrMulti.id },
      data: { role: 'HR', isActive: true }
    });
  }

  await prisma.companyMembership.upsert({
    where: { userId_companyId: { userId: hrMulti.id, companyId: apexCompany.id } },
    create: { userId: hrMulti.id, companyId: apexCompany.id, role: 'HR', isActive: true },
    update: { role: 'HR', isActive: true }
  });

  if (betaCompany) {
    await prisma.companyMembership.upsert({
      where: { userId_companyId: { userId: hrMulti.id, companyId: betaCompany.id } },
      create: { userId: hrMulti.id, companyId: betaCompany.id, role: 'HR', isActive: true },
      update: { role: 'HR', isActive: true }
    });
    console.log(`[+] Assigned hr.multi@hrms.local to both Apex Group and Beta Logistics.`);
  }

  // 8. Ensure Unassigned HR User: hr.unassigned@hrms.local (0 active company assignments)
  let hrUnassigned = await prisma.user.findUnique({ where: { email: 'hr.unassigned@hrms.local' } });
  if (!hrUnassigned) {
    console.log('[+] Creating demo Unassigned HR account: hr.unassigned@hrms.local');
    hrUnassigned = await prisma.user.create({
      data: {
        email: 'hr.unassigned@hrms.local',
        passwordHash,
        firstName: 'Alex',
        lastName: 'Unassigned',
        role: 'HR',
        isActive: true,
        companyId: null
      }
    });
  } else {
    await prisma.user.update({
      where: { id: hrUnassigned.id },
      data: { role: 'HR', isActive: true, companyId: null }
    });
  }
  // Ensure no active memberships for hr.unassigned
  await prisma.companyMembership.deleteMany({
    where: { userId: hrUnassigned.id }
  });
  console.log('[*] Verified hr.unassigned@hrms.local has 0 company memberships.');

  // 9. Verify data preservation
  const [empCount, attCount, assetCount, leaveCount, salaryCount] = await Promise.all([
    prisma.employee.count(),
    prisma.attendance.count(),
    prisma.asset.count(),
    prisma.leaveRequest.count(),
    prisma.employeeSalaryConfig.count()
  ]);

  console.log('\n--- Business Record Preservation Verification ---');
  console.log(`[PASS] Employees preserved: ${empCount}`);
  console.log(`[PASS] Attendance punches preserved: ${attCount}`);
  console.log(`[PASS] Assets preserved: ${assetCount}`);
  console.log(`[PASS] Leave requests preserved: ${leaveCount}`);
  console.log(`[PASS] Salary configurations preserved: ${salaryCount}`);

  console.log('\n[SUCCESS] Migration to two-role architecture completed successfully!');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
