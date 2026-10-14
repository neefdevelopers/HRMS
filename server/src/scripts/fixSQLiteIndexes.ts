import { prisma } from '../config/prisma.js';

async function fixIndexes() {
  console.log('[*] Checking and updating SQLite indexes for tenant-scoped uniqueness...');

  // 1. List indexes on Employee
  const indexes: any = await prisma.$queryRawUnsafe(`SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'Employee'`);
  console.log('Current Employee indexes:', indexes.map((i: any) => i.name));

  // 2. Drop old globally unique indexes that should be company-scoped
  const oldIndexes = [
    'Employee_employeeId_key',
    'Brand_code_key',
    'Asset_assetTag_key',
    'SystemSetting_key_key'
  ];

  for (const idx of oldIndexes) {
    try {
      await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "${idx}"`);
      console.log(`[+] Dropped legacy global index: ${idx}`);
    } catch (e: any) {
      console.log(`[-] Could not drop ${idx}: ${e.message}`);
    }
  }

  // 3. Ensure compound tenant indexes exist
  const compoundIndexes = [
    `CREATE UNIQUE INDEX IF NOT EXISTS "Employee_companyId_employeeId_key" ON "Employee"("companyId", "employeeId")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Brand_companyId_code_key" ON "Brand"("companyId", "code")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Asset_companyId_assetTag_key" ON "Asset"("companyId", "assetTag")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "SystemSetting_companyId_key_key" ON "SystemSetting"("companyId", "key")`
  ];

  for (const sql of compoundIndexes) {
    await prisma.$executeRawUnsafe(sql);
    console.log(`[+] Verified compound tenant index: ${sql.split('ON')[1].trim()}`);
  }

  console.log('[✔] SQLite indexes updated successfully.');
}

fixIndexes()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
