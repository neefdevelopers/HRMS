import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrate() {
  console.log('--- STARTING MULTI-COMPANY DATA MIGRATION ---');
  
  // 1. Create Company table if not exists
  console.log('1. Creating Company and CompanyMembership tables if not exist...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Company" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "code" TEXT NOT NULL,
      "logo" TEXT,
      "email" TEXT NOT NULL,
      "phone" TEXT,
      "address" TEXT,
      "registrationNumber" TEXT,
      "taxId" TEXT,
      "isActive" BOOLEAN NOT NULL DEFAULT 1,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Company_code_key" ON "Company"("code");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CompanyMembership" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "companyId" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'COMPANY_HR',
      "isActive" BOOLEAN NOT NULL DEFAULT 1,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "CompanyMembership_userId_companyId_key" ON "CompanyMembership"("userId", "companyId");
  `);

  // 2. Add companyId column to tables
  console.log('2. Adding companyId column to relevant entities...');
  const addColumnIfNotExists = async (table: string, column: string, colDef: string) => {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${colDef};`);
      console.log(`+ Added column ${column} to ${table}`);
    } catch (e: any) {
      if (!e.message.includes('duplicate column name')) {
        console.warn(`Note on ${table}.${column}:`, e.message);
      }
    }
  };

  const tablesToScope = [
    'Brand',
    'Employee',
    'User',
    'Asset',
    'EmployeeDocument',
    'ExitRequest',
    'PunchingDevice',
    'SystemSetting',
    'AuditLog',
    'Notification',
    'PayrollPeriod',
    'PayrollSummary',
    'Attendance',
    'LeaveRequest'
  ];

  for (const table of tablesToScope) {
    await addColumnIfNotExists(table, 'companyId', 'TEXT');
  }

  // 3. Create Initial Company: Apex Group Enterprises
  console.log('3. Seeding initial Company: Apex Group Enterprises (APEX_CORP)...');
  const initialCompanyId = 'apex-corp-001';
  await prisma.$executeRawUnsafe(`
    INSERT OR IGNORE INTO "Company" ("id", "name", "code", "email", "phone", "address", "isActive", "createdAt", "updatedAt")
    VALUES ('${initialCompanyId}', 'Apex Group Enterprises', 'APEX_CORP', 'contact@apexenterprises.com', '+91 22 4500 1000', 'Apex Tower, Bandra Kurla Complex, Mumbai', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  `);

  // 4. Backfill records with initialCompanyId
  console.log('4. Backfilling existing brands, employees, and tenant records...');
  for (const table of tablesToScope) {
    if (table === 'User') {
      // Admin remains platform-level (companyId can be null), other users get assigned to Apex Corp
      await prisma.$executeRawUnsafe(`UPDATE "User" SET "companyId" = '${initialCompanyId}' WHERE "companyId" IS NULL AND "role" != 'ADMIN';`);
    } else {
      await prisma.$executeRawUnsafe(`UPDATE "${table}" SET "companyId" = '${initialCompanyId}' WHERE "companyId" IS NULL;`);
    }
  }

  // 5. Create Company Memberships for all existing users
  console.log('5. Creating Company Memberships for existing users...');
  const users: any[] = await prisma.$queryRawUnsafe(`SELECT "id", "email", "role" FROM "User";`);
  for (const u of users) {
    const membershipRole = u.role === 'ADMIN' ? 'ADMIN' : 'HR';
    await prisma.$executeRawUnsafe(`
      INSERT OR REPLACE INTO "CompanyMembership" ("id", "userId", "companyId", "role", "isActive", "createdAt", "updatedAt")
      VALUES ('mem-${u.id}', '${u.id}', '${initialCompanyId}', '${membershipRole}', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    `);
  }

  // Verification queries
  const brandCount: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as c FROM "Brand" WHERE "companyId" = '${initialCompanyId}';`);
  const empCount: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as c FROM "Employee" WHERE "companyId" = '${initialCompanyId}';`);
  const memCount: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as c FROM "CompanyMembership";`);
  const userCount: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as c FROM "User";`);

  console.log('--- MIGRATION VERIFICATION ---');
  console.log({
    totalUsers: userCount[0].c,
    brandsMigratedToCompany: brandCount[0].c,
    employeesMigratedToCompany: empCount[0].c,
    membershipsCreated: memCount[0].c
  });
  console.log('--- MULTI-COMPANY MIGRATION COMPLETED SUCCESSFULLY ---');
}

migrate()
  .catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
