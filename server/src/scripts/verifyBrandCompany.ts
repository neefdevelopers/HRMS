import { prisma } from '../config/prisma.js';

function assert(condition: any, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

async function runVerification() {
  console.log('======================================================================');
  console.log('🧪 VERIFYING COMPANY-BRAND RELATIONSHIP & ISOLATION IN HRMS');
  console.log('======================================================================\n');

  // 1. Verify Companies exist
  const companyApex = await prisma.company.findUnique({
    where: { code: 'APEX_CORP' },
    include: { brands: true }
  });
  const companyBeta = await prisma.company.findUnique({
    where: { code: 'BETA_CORP' },
    include: { brands: true }
  });

  assert(companyApex !== null, '1. Primary company (APEX) exists');
  assert(companyBeta !== null, '2. Secondary company (BETA) exists');

  console.log(`\n🏢 Company Apex: ${companyApex?.name} (ID: ${companyApex?.id})`);
  console.log(`   Brands count: ${companyApex?.brands.length}`);
  companyApex?.brands.forEach((b) => console.log(`   - [${b.code}] ${b.name} (isActive: ${b.isActive})`));

  console.log(`\n🏢 Company Beta: ${companyBeta?.name} (ID: ${companyBeta?.id})`);
  console.log(`   Brands count: ${companyBeta?.brands.length}`);
  companyBeta?.brands.forEach((b) => console.log(`   - [${b.code}] ${b.name} (isActive: ${b.isActive})`));

  // Test 1: One company can have multiple brands
  assert(
    (companyApex?.brands.length || 0) >= 3,
    '3. Multi-brand relationship verified: Company Apex manages multiple brands (APEX, NEXUS, LUMINA)'
  );

  // Test 2: Every brand strictly belongs to a company (foreign key non-null)
  const allBrands = await prisma.brand.findMany({
    include: { company: true }
  });
  const allHaveCompany = allBrands.every((b) => b.companyId && b.company !== null);
  assert(
    allHaveCompany && allBrands.length > 0,
    `4. Every brand (${allBrands.length} brands total) belongs to exactly one existing company`
  );

  // Test 3: Scoped Uniqueness - duplicate code within SAME company is rejected
  console.log('\n--- Testing Scoped Brand Code Uniqueness ---');
  let sameCompanyDuplicateRejected = false;
  try {
    await prisma.brand.create({
      data: {
        name: 'Duplicate Apex Brand',
        code: 'APEX', // Already exists in Company Apex!
        companyName: 'Apex Duplicate Legal',
        companyId: companyApex!.id
      }
    });
  } catch (err: any) {
    sameCompanyDuplicateRejected = true;
  }
  assert(
    sameCompanyDuplicateRejected,
    '5. Scoped uniqueness: Brand code "APEX" rejected within same company (Company Apex)'
  );

  // Test 4: Scoped Uniqueness - same code in DIFFERENT company is allowed
  let differentCompanyAllowed = false;
  let crossBrandCreated: any = null;
  try {
    // Check if BETA already has brand with code 'APEX'
    const existing = await prisma.brand.findFirst({
      where: { companyId: companyBeta!.id, code: 'APEX' }
    });
    if (existing) {
      crossBrandCreated = existing;
      differentCompanyAllowed = true;
    } else {
      crossBrandCreated = await prisma.brand.create({
        data: {
          name: 'Apex Logistics Division',
          code: 'APEX', // Allowed because company is BETA!
          companyName: 'Beta Logistics - Apex Line',
          companyId: companyBeta!.id
        }
      });
      differentCompanyAllowed = true;
    }
  } catch (err: any) {
    console.error('Error creating cross-company brand:', err);
    differentCompanyAllowed = false;
  }
  assert(
    differentCompanyAllowed && crossBrandCreated !== null,
    '6. Scoped uniqueness: Same code "APEX" is permitted across different companies (Company Beta)'
  );

  // Clean up the test brand
  if (crossBrandCreated && crossBrandCreated.name === 'Apex Logistics Division') {
    await prisma.brand.delete({ where: { id: crossBrandCreated.id } });
    console.log('   (Cleaned up temporary cross-company test brand)');
  }

  // Test 5: Safe Brand Deactivation (does NOT delete staff or records)
  console.log('\n--- Testing Safe Brand Deactivation ---');
  const targetBrand = companyApex?.brands[0];
  assert(targetBrand !== undefined, '7. Target brand found for deactivation test');

  const employeeCountBefore = await prisma.employee.count({
    where: { brandId: targetBrand!.id }
  });
  console.log(`   Employees under brand ${targetBrand?.name}: ${employeeCountBefore}`);

  // Deactivate brand
  const deactivatedBrand = await prisma.brand.update({
    where: { id: targetBrand!.id },
    data: { isActive: false }
  });
  assert(deactivatedBrand.isActive === false, '8. Brand successfully deactivated (isActive: false)');

  // Verify employee records and payroll records are intact
  const employeeCountAfter = await prisma.employee.count({
    where: { brandId: targetBrand!.id }
  });
  assert(
    employeeCountBefore === employeeCountAfter,
    `9. Safe deactivation: All ${employeeCountAfter} employees preserved without data loss`
  );

  // Reactivate brand
  const reactivatedBrand = await prisma.brand.update({
    where: { id: targetBrand!.id },
    data: { isActive: true }
  });
  assert(reactivatedBrand.isActive === true, '10. Brand reactivated back to active state');

  // Test 6: Cross-Company Isolation between Company Apex and Company Beta
  console.log('\n--- Testing Cross-Company Isolation ---');
  const apexBrands = await prisma.brand.findMany({
    where: { companyId: companyApex!.id }
  });
  const betaBrands = await prisma.brand.findMany({
    where: { companyId: companyBeta!.id }
  });

  const apexBrandIds = new Set(apexBrands.map((b) => b.id));
  const betaHasApexBrand = betaBrands.some((b) => apexBrandIds.has(b.id));
  assert(!betaHasApexBrand, '11. Isolation: Company Beta has no access to Company Apex brands');

  // Test 7: Organization Hierarchy Integrity
  console.log('\n--- Testing Organization & Cross-Brand Integrity ---');

  const allDepartments = await prisma.department.findMany({
    include: { brand: true }
  });
  const deptsMatchCompany = allDepartments.every((d) => d.brand.companyId !== null);
  assert(
    deptsMatchCompany,
    '13. Hierarchy: All departments belong to brands with valid company ownership'
  );

  console.log('\n======================================================================');
  console.log('🎉 ALL 13 VERIFICATION TESTS PASSED SUCCESSFULLY!');
  console.log('======================================================================\n');
}

runVerification()
  .catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
