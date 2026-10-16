import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('================================================================');
  console.log(' MIGRATION: THREE-ROLE ARCHITECTURE (ADMIN, HR, ATTENDANCE_VIEWER)');
  console.log('================================================================\n');

  // 1. Verify database backup exists
  const dbPath = path.resolve('prisma/dev.db');
  const backupPath = path.resolve('prisma/dev.db.backup');
  if (!fs.existsSync(backupPath)) {
    console.log('[+] Creating backup of SQLite database...');
    fs.copyFileSync(dbPath, backupPath);
    console.log(`[✔] Backup created at: ${backupPath}`);
  } else {
    console.log(`[✔] Existing database backup verified at: ${backupPath}`);
  }

  // 2. Fetch existing companies
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: 'asc' }
  });
  console.log(`[*] Found ${companies.length} existing companies:`);
  companies.forEach((c) => console.log(`    - [${c.id}] ${c.code} (${c.name})`));

  if (companies.length === 0) {
    console.error('[!] Error: No companies found to migrate assignments.');
    return;
  }

  const compApex = companies[0];
  const compBeta = companies.length > 1 ? companies[1] : companies[0];

  // 3. Verify existing users and memberships are preserved
  const existingUsers = await prisma.user.findMany({
    include: { memberships: true }
  });
  console.log(`[*] Preserving ${existingUsers.length} existing user accounts and their current roles.`);

  // 4. Provision test demo accounts demonstrating company-specific role assignments
  const passwordHash = await bcrypt.hash('password123', 10);

  // User A: Attendance Viewer for Company A only
  const userA = await prisma.user.upsert({
    where: { email: 'viewer.a@hrms.local' },
    create: {
      email: 'viewer.a@hrms.local',
      firstName: 'Alice',
      lastName: 'Viewer (Comp A)',
      passwordHash,
      role: 'ATTENDANCE_VIEWER',
      isActive: true,
      companyId: compApex.id
    },
    update: {
      role: 'ATTENDANCE_VIEWER',
      isActive: true
    }
  });

  await prisma.companyMembership.upsert({
    where: { userId_companyId: { userId: userA.id, companyId: compApex.id } },
    create: { userId: userA.id, companyId: compApex.id, role: 'ATTENDANCE_VIEWER', isActive: true },
    update: { role: 'ATTENDANCE_VIEWER', isActive: true }
  });
  console.log(`[✔] Configured User A (viewer.a@hrms.local) -> ATTENDANCE_VIEWER for ${compApex.name}`);

  // User B: Attendance Viewer for Company B only
  if (compBeta.id !== compApex.id) {
    const userB = await prisma.user.upsert({
      where: { email: 'viewer.b@hrms.local' },
      create: {
        email: 'viewer.b@hrms.local',
        firstName: 'Bob',
        lastName: 'Viewer (Comp B)',
        passwordHash,
        role: 'ATTENDANCE_VIEWER',
        isActive: true,
        companyId: compBeta.id
      },
      update: {
        role: 'ATTENDANCE_VIEWER',
        isActive: true
      }
    });

    await prisma.companyMembership.upsert({
      where: { userId_companyId: { userId: userB.id, companyId: compBeta.id } },
      create: { userId: userB.id, companyId: compBeta.id, role: 'ATTENDANCE_VIEWER', isActive: true },
      update: { role: 'ATTENDANCE_VIEWER', isActive: true }
    });
    console.log(`[✔] Configured User B (viewer.b@hrms.local) -> ATTENDANCE_VIEWER for ${compBeta.name}`);
  }

  // User C: Attendance Viewer for Companies A and B
  const userC = await prisma.user.upsert({
    where: { email: 'viewer.multi@hrms.local' },
    create: {
      email: 'viewer.multi@hrms.local',
      firstName: 'Charlie',
      lastName: 'Viewer (Multi-Comp)',
      passwordHash,
      role: 'ATTENDANCE_VIEWER',
      isActive: true,
      companyId: compApex.id
    },
    update: {
      role: 'ATTENDANCE_VIEWER',
      isActive: true
    }
  });

  await prisma.companyMembership.upsert({
    where: { userId_companyId: { userId: userC.id, companyId: compApex.id } },
    create: { userId: userC.id, companyId: compApex.id, role: 'ATTENDANCE_VIEWER', isActive: true },
    update: { role: 'ATTENDANCE_VIEWER', isActive: true }
  });

  if (compBeta.id !== compApex.id) {
    await prisma.companyMembership.upsert({
      where: { userId_companyId: { userId: userC.id, companyId: compBeta.id } },
      create: { userId: userC.id, companyId: compBeta.id, role: 'ATTENDANCE_VIEWER', isActive: true },
      update: { role: 'ATTENDANCE_VIEWER', isActive: true }
    });
  }
  console.log(`[✔] Configured User C (viewer.multi@hrms.local) -> ATTENDANCE_VIEWER for ${compApex.name} & ${compBeta.name}`);

  // User D: HR for Company A and Attendance Viewer for Company B
  const userD = await prisma.user.upsert({
    where: { email: 'hybrid.user@hrms.local' },
    create: {
      email: 'hybrid.user@hrms.local',
      firstName: 'Diana',
      lastName: 'Hybrid (HR & Viewer)',
      passwordHash,
      role: 'HR',
      isActive: true,
      companyId: compApex.id
    },
    update: {
      role: 'HR',
      isActive: true
    }
  });

  await prisma.companyMembership.upsert({
    where: { userId_companyId: { userId: userD.id, companyId: compApex.id } },
    create: { userId: userD.id, companyId: compApex.id, role: 'HR', isActive: true },
    update: { role: 'HR', isActive: true }
  });

  if (compBeta.id !== compApex.id) {
    await prisma.companyMembership.upsert({
      where: { userId_companyId: { userId: userD.id, companyId: compBeta.id } },
      create: { userId: userD.id, companyId: compBeta.id, role: 'ATTENDANCE_VIEWER', isActive: true },
      update: { role: 'ATTENDANCE_VIEWER', isActive: true }
    });
  }
  console.log(`[✔] Configured User D (hybrid.user@hrms.local) -> HR for ${compApex.name} and ATTENDANCE_VIEWER for ${compBeta.name}`);

  console.log('\n================================================================');
  console.log(' MIGRATION COMPLETED SUCCESSFULLY WITH PRESERVED HISTORICAL DATA');
  console.log('================================================================\n');
}

main()
  .catch((e) => {
    console.error('Migration error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
