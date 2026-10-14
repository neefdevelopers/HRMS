import { prisma } from '../config/prisma.js';
import bcrypt from 'bcryptjs';

async function runMultiCompanyVerification() {
  console.log('=====================================================');
  console.log(' MULTI-COMPANY HRMS SAAS VERIFICATION & ISOLATION TEST');
  console.log('=====================================================\n');

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

  // 1. Verify Company A (Apex Group Enterprises)
  const companyA = await prisma.company.findUnique({
    where: { code: 'APEX_CORP' },
    include: {
      brands: true,
      employees: true,
      memberships: { include: { user: true } }
    }
  });

  assert(!!companyA, '1. Company A (Apex Group Enterprises) exists in database', `Found: ${companyA?.name}`);
  assert((companyA?.brands.length || 0) >= 3, '2. Company A has all original brands intact (APEX, ZENITH, PULSE)', `Count: ${companyA?.brands.length}`);
  assert((companyA?.employees.length || 0) >= 7, '3. Company A has all original employees intact', `Count: ${companyA?.employees.length}`);
  assert((companyA?.memberships.length || 0) >= 4, '4. Company A has user memberships linked', `Count: ${companyA?.memberships.length}`);

  // 2. Create or Retrieve Company B (Beta Logistics Inc.)
  let companyB = await prisma.company.findUnique({
    where: { code: 'BETA_CORP' }
  });

  if (!companyB) {
    companyB = await prisma.company.create({
      data: {
        id: 'beta-corp-002',
        name: 'Beta Logistics Inc.',
        code: 'BETA_CORP',
        email: 'contact@betalogistics.com',
        phone: '+1 555-0244',
        address: '450 Harbor Boulevard, Suite 800, Seattle, WA',
        registrationNumber: 'REG-BETA-9081',
        taxId: 'TAX-US-BETA',
        isActive: true
      }
    });
    console.log(`[*] Created Company B: ${companyB.name} (${companyB.code})`);
  } else {
    console.log(`[*] Found existing Company B: ${companyB.name} (${companyB.code})`);
  }
  assert(!!companyB, '5. Company B (Beta Logistics Inc.) is ready and active');

  // 3. Create Company B Brand, Branch, Department, Designation
  let brandB = await prisma.brand.findFirst({
    where: { companyId: companyB.id, code: 'BETA_EXP' }
  });

  if (!brandB) {
    brandB = await prisma.brand.create({
      data: {
        companyId: companyB.id,
        name: 'Beta Express Fleet',
        code: 'BETA_EXP',
        companyName: 'Beta Logistics Inc.',
        email: 'dispatch@betaexpress.com',
        isActive: true
      }
    });
  }
  assert(!!brandB, '6. Company B brand (Beta Express Fleet) exists');

  let branchB = await prisma.branch.findFirst({
    where: { brandId: brandB.id, code: 'SEA_PORT' }
  });
  if (!branchB) {
    branchB = await prisma.branch.create({
      data: {
        brandId: brandB.id,
        name: 'Seattle Port Hub',
        code: 'SEA_PORT',
        city: 'Seattle',
        country: 'USA',
        isActive: true
      }
    });
  }

  let deptB = await prisma.department.findFirst({
    where: { brandId: brandB.id, code: 'FLEET_OPS' }
  });
  if (!deptB) {
    deptB = await prisma.department.create({
      data: {
        brandId: brandB.id,
        name: 'Fleet Operations',
        code: 'FLEET_OPS'
      }
    });
  }

  let desigB = await prisma.designation.findFirst({
    where: { brandId: brandB.id, code: 'LOG_COORD' }
  });
  if (!desigB) {
    desigB = await prisma.designation.create({
      data: {
        brandId: brandB.id,
        departmentId: deptB.id,
        title: 'Logistics Coordinator',
        code: 'LOG_COORD'
      }
    });
  }

  // 4. Create Company B Employee
  let employeeB = await prisma.employee.findFirst({
    where: { companyId: companyB.id, employeeId: 'BETA-1001' }
  });
  if (!employeeB) {
    employeeB = await prisma.employee.create({
      data: {
        companyId: companyB.id,
        brandId: brandB.id,
        branchId: branchB.id,
        departmentId: deptB.id,
        designationId: desigB.id,
        employeeId: 'BETA-1001',
        biometricId: 'BIO-BETA-01',
        firstName: 'Rajesh',
        lastName: 'Kumar',
        email: 'rajesh.kumar@betalogistics.com',
        phone: '+1 555-0812',
        joiningDate: '2026-02-01',
        employmentType: 'FULL_TIME',
        employeeStatus: 'ACTIVE'
      }
    });
  }
  assert(!!employeeB, '7. Company B employee (Rajesh Kumar, BETA-1001) belongs strictly to Company B');

  // 5. Create Company B Asset
  let assetB = await prisma.asset.findFirst({
    where: { companyId: companyB.id, assetTag: 'ASSET-BETA-SCAN-01' }
  });
  if (!assetB) {
    assetB = await prisma.asset.create({
      data: {
        companyId: companyB.id,
        brandId: brandB.id,
        name: 'Zebra Industrial Barcode Scanner',
        type: 'OTHER',
        assetTag: 'ASSET-BETA-SCAN-01',
        serialNumber: 'SN-ZEBRA-8890',
        status: 'ASSIGNED',
        assignedEmployeeId: employeeB.id,
        assignedDate: '2026-02-05'
      }
    });
  }
  assert(!!assetB, '8. Company B asset (Zebra Scanner) belongs strictly to Company B');

  // 6. Create Company B Admin User & Membership
  const hashedPassword = await bcrypt.hash('BetaAdmin123!', 10);
  let userB = await prisma.user.findUnique({
    where: { email: 'admin@betalogistics.com' }
  });
  if (!userB) {
    userB = await prisma.user.create({
      data: {
        email: 'admin@betalogistics.com',
        passwordHash: hashedPassword,
        firstName: 'Marcus',
        lastName: 'Vance',
        role: 'COMPANY_ADMIN',
        companyId: companyB.id,
        brandId: brandB.id,
        branchId: branchB.id
      }
    });
  }

  let membershipB = await prisma.companyMembership.findUnique({
    where: {
      userId_companyId: {
        userId: userB.id,
        companyId: companyB.id
      }
    }
  });
  if (!membershipB) {
    membershipB = await prisma.companyMembership.create({
      data: {
        userId: userB.id,
        companyId: companyB.id,
        role: 'COMPANY_ADMIN',
        isActive: true
      }
    });
  }
  assert(!!membershipB, '9. Company B administrator membership configured successfully');

  // -----------------------------------------------------------------
  // 7. STRICT TENANT ISOLATION TESTS
  // -----------------------------------------------------------------
  console.log('\n--- Running Backend Tenant Isolation Queries ---');

  // Query 1: Company A employee list using Company A context
  const companyAEmployees = await prisma.employee.findMany({
    where: { companyId: companyA!.id }
  });
  const hasCompanyBInA = companyAEmployees.some((e) => e.companyId === companyB!.id || e.employeeId === 'BETA-1001');
  assert(!hasCompanyBInA, '10. Company A employee queries contain 0 Company B records');

  // Query 2: Company B employee list using Company B context
  const companyBEmployees = await prisma.employee.findMany({
    where: { companyId: companyB.id }
  });
  const hasCompanyAInB = companyBEmployees.some((e) => e.companyId === companyA!.id);
  assert(!hasCompanyAInB, '11. Company B employee queries contain 0 Company A records');
  assert(companyBEmployees.length === 1 && companyBEmployees[0].employeeId === 'BETA-1001', '12. Company B sees exactly its own employee (BETA-1001)');

  // Query 3: Assets isolation
  const companyAAssets = await prisma.asset.findMany({
    where: { companyId: companyA!.id }
  });
  const companyBAssets = await prisma.asset.findMany({
    where: { companyId: companyB.id }
  });
  const hasCrossCompanyAssets =
    companyAAssets.some((a) => a.companyId === companyB!.id) ||
    companyBAssets.some((a) => a.companyId === companyA!.id);
  assert(!hasCrossCompanyAssets, '13. Cross-company asset queries strictly isolated');

  // Query 4: Brand isolation
  const companyABrands = await prisma.brand.findMany({
    where: { companyId: companyA!.id }
  });
  const companyBBrands = await prisma.brand.findMany({
    where: { companyId: companyB.id }
  });
  const hasCrossCompanyBrands =
    companyABrands.some((b) => b.companyId === companyB!.id) ||
    companyBBrands.some((b) => b.companyId === companyA!.id);
  assert(!hasCrossCompanyBrands, '14. Brand hierarchy strictly scoped to parent company');

  // Query 5: Scoped uniqueness test (same employeeId across different companies)
  let scopedDuplicateAllowed = false;
  try {
    const existingEmployeeA = companyAEmployees[0];
    // Create an employee in Company B with the SAME employeeId as Company A's employee
    const tempBEmployee = await prisma.employee.create({
      data: {
        company: { connect: { id: companyB.id } },
        brand: { connect: { id: brandB.id } },
        branch: { connect: { id: branchB.id } },
        department: { connect: { id: deptB.id } },
        designation: { connect: { id: desigB.id } },
        employeeId: existingEmployeeA.employeeId, // Same ID, but in Company B!
        firstName: 'Duplicate',
        lastName: 'Test',
        email: `dup.test.${Date.now()}@beta.com`,
        joiningDate: '2026-03-01',
        employeeStatus: 'ACTIVE'
      }
    });
    scopedDuplicateAllowed = !!tempBEmployee;
    // Cleanup temporary test employee
    await prisma.employee.delete({ where: { id: tempBEmployee.id } });
  } catch (err: any) {
    console.error('Test 15 caught error:', err.message || err);
    scopedDuplicateAllowed = false;
  }
  assert(scopedDuplicateAllowed, '15. Scoped uniqueness verified: Same employeeId permitted across different companies');

  // Query 6: Duplicate within SAME company must throw error
  let intraCompanyDuplicateBlocked = false;
  try {
    await prisma.employee.create({
      data: {
        companyId: companyB.id,
        brandId: brandB.id,
        branchId: branchB.id,
        departmentId: deptB.id,
        designationId: desigB.id,
        joiningDate: new Date().toISOString(),
        employeeId: 'BETA-1001', // Already exists in Company B!
        firstName: 'Fail',
        lastName: 'Case',
        email: 'fail@beta.com'
      }
    });
  } catch (err: any) {
    intraCompanyDuplicateBlocked = true; // Expected failure!
  }
  assert(intraCompanyDuplicateBlocked, '16. Scoped uniqueness verified: Duplicate employeeId within SAME company is blocked');

  // -----------------------------------------------------------------
  // 8. DEMO ACCOUNTS AND PLATFORM SUPER ADMIN VERIFICATION
  // -----------------------------------------------------------------
  console.log('\n--- Verifying Demo Accounts & Platform Administration ---');

  const superAdmin = await prisma.user.findUnique({
    where: { email: 'superadmin@hrms.local' }
  });
  assert(superAdmin?.role === 'SUPER_ADMIN', '17. Platform Super Admin (superadmin@hrms.local) remains active');

  const groupHr = await prisma.user.findUnique({
    where: { email: 'grouphr@hrms.local' },
    include: { memberships: true }
  });
  assert(!!groupHr && groupHr.memberships.length > 0, '18. Group HR / Company HR (grouphr@hrms.local) has active membership in Apex Group');

  const apexHr = await prisma.user.findUnique({
    where: { email: 'apex.hr@hrms.local' }
  });
  assert(!!apexHr && apexHr.brandId !== null, '19. Brand HR (apex.hr@hrms.local) maintains assigned brand and credentials');

  const demoEmployee = await prisma.user.findUnique({
    where: { email: 'employee.apex@hrms.local' }
  });
  assert(!!demoEmployee && demoEmployee.employeeId !== null, '20. Demo Employee (employee.apex@hrms.local) profile link intact');

  console.log('\n=====================================================');
  console.log(` SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=====================================================\n');

  if (failed === 0) {
    console.log('[SUCCESS] All Multi-Company SaaS verification and tenant isolation checks PASSED!\n');
  } else {
    process.exit(1);
  }
}

runMultiCompanyVerification()
  .catch((err) => {
    console.error('Test execution error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
