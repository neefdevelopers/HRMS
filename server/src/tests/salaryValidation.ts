import { prisma } from '../config/prisma.js';
import { salaryCalculator } from '../services/salaryCalculator.js';
import { receiptPdfService } from '../services/receiptPdfService.js';
import { numberToIndianCurrencyWords } from '../utils/numberToWords.js';

async function runTests() {
  console.log('=== HRMS SALARY PROCESSING MODULE TEST SUITE ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`, detail || '');
      failed++;
    }
  }

  try {
    // Fetch Apex brand and employee Arjun Mehta
    const brand = await prisma.brand.findFirst({ where: { code: 'APEX' } });
    if (!brand) throw new Error('Brand APEX not found');

    const arjun = await prisma.employee.findFirst({ where: { employeeId: 'APEX-1002' } });
    if (!arjun) throw new Error('Employee APEX-1002 not found');

    const ananya = await prisma.employee.findFirst({ where: { employeeId: 'APEX-1004' } });
    if (!ananya) throw new Error('Employee APEX-1004 not found');

    // TEST 1: Fixed salary configuration retrieval
    const config = await salaryCalculator.getEffectiveSalaryConfig(arjun.id, '2026-10-01', '2026-10-31');
    assert(config !== null && config.monthlySalary === 45000, 'Test 1: Retrieves active effective salary configuration (₹45,000)');

    // TEST 2: Salary Calculation with OT and Approved Incentives
    const calcArjun = await salaryCalculator.calculateSalary({
      employeeId: arjun.id,
      brandId: brand.id,
      payrollMonth: '2026-10',
      startDate: '2026-10-01',
      endDate: '2026-10-31'
    });

    assert(calcArjun.baseSalary === 45000, 'Test 2A: Fixed base salary is ₹45,000');
    assert(calcArjun.approvedIncentivesAmount === 2500, `Test 2B: Approved incentive included (₹${calcArjun.approvedIncentivesAmount} === ₹2,500)`);
    assert(calcArjun.netSalary === calcArjun.grossEarnings - calcArjun.totalDeductions, 'Test 2C: Net salary equals gross earnings minus total deductions');

    // TEST 3: Unapproved incentives are excluded
    // Create a pending incentive for Arjun
    const pendingInc = await prisma.incentive.create({
      data: {
        employeeId: arjun.id,
        brandId: brand.id,
        payrollMonth: '2026-10',
        title: 'Unapproved Bonus Test',
        amount: 5000,
        incentiveType: 'FIXED',
        calculatedAmount: 5000,
        status: 'PENDING'
      }
    });

    const calcArjunAfterPending = await salaryCalculator.calculateSalary({
      employeeId: arjun.id,
      brandId: brand.id,
      payrollMonth: '2026-10',
      startDate: '2026-10-01',
      endDate: '2026-10-31'
    });

    assert(
      calcArjunAfterPending.approvedIncentivesAmount === 2500,
      'Test 3: Unapproved incentive of ₹5,000 is strictly excluded from approved incentives'
    );

    // Clean up temporary pending incentive
    await prisma.incentive.delete({ where: { id: pendingInc.id } });

    // TEST 4: Percentage-based incentive calculation
    const rohan = await prisma.employee.findFirst({ where: { employeeId: 'APEX-1003' } });
    if (rohan) {
      const calcRohan = await salaryCalculator.calculateSalary({
        employeeId: rohan.id,
        brandId: brand.id,
        payrollMonth: '2026-10',
        startDate: '2026-10-01',
        endDate: '2026-10-31'
      });
      // Rohan has base 50,000 and 5% approved bonus -> 2,500
      assert(calcRohan.approvedIncentivesAmount === 2500, `Test 4: 5% incentive on ₹50,000 equals ₹2,500 (Actual: ₹${calcRohan.approvedIncentivesAmount})`);
    }

    // TEST 5: Proration for Employee Joining Mid-Month
    // Ananya joined on '2026-10-01' so she is full month. Let's create a temporary mid-month hire
    const tempHire = await prisma.employee.create({
      data: {
        employeeId: 'TEST-9999',
        brandId: brand.id,
        branchId: arjun.branchId,
        departmentId: arjun.departmentId,
        designationId: arjun.designationId,
        firstName: 'Test',
        lastName: 'Prorate',
        email: 'test.prorate@apexretail.local',
        joiningDate: '2026-10-16', // Joined exactly half-way through 31-day month (16 days active)
        employeeStatus: 'ACTIVE'
      }
    });

    await prisma.employeeSalaryConfig.create({
      data: {
        employeeId: tempHire.id,
        brandId: brand.id,
        monthlySalary: 31000.0, // ₹1,000/day
        standardWorkingDays: 26,
        standardWorkingHoursPerDay: 8.0,
        effectiveFrom: '2026-10-01',
        status: 'ACTIVE'
      }
    });

    const calcProrate = await salaryCalculator.calculateSalary({
      employeeId: tempHire.id,
      brandId: brand.id,
      payrollMonth: '2026-10',
      startDate: '2026-10-01',
      endDate: '2026-10-31'
    });

    assert(calcProrate.isProrated === true, 'Test 5A: Mid-month hire flagged as prorated');
    // Active days = 31 - 16 + 1 = 16 days. Prorated salary = 31000 * (16 / 31) = 16000
    assert(calcProrate.payableSalary === 16000, `Test 5B: Prorated salary calculation is exact: ₹16,000 (Actual: ₹${calcProrate.payableSalary})`);

    // Clean up temporary hire
    await prisma.employeeSalaryConfig.deleteMany({ where: { employeeId: tempHire.id } });
    await prisma.employee.delete({ where: { id: tempHire.id } });

    // TEST 6: Amount in Words Helper
    const wordsTest = numberToIndianCurrencyWords(49500);
    assert(
      wordsTest.includes('Forty Nine Thousand Five Hundred Rupees'),
      `Test 6: Amount in words formats correctly: "${wordsTest}"`
    );

    // TEST 7: PDF Generation Service
    const pdfBuffer = await receiptPdfService.generateSalaryReceiptPdf({
      receiptNumber: 'REC-TEST-202610-001',
      issueDate: '2026-10-31',
      payrollPeriod: '2026-10',
      companyName: 'Apex Omnichannel Retail Enterprises Ltd.',
      brandName: 'Apex Retail Group',
      employeeName: 'Arjun Mehta',
      employeeId: 'APEX-1002',
      department: 'Engineering & Technology',
      designation: 'Software Development Engineer',
      branch: 'Mumbai HQ - BKC',
      joiningDate: '2023-04-01',
      currency: 'INR',
      baseSalary: 45000,
      payableSalary: 45000,
      isProrated: false,
      approvedOtHours: 8,
      otRate: 250,
      otPayment: 2000,
      approvedIncentivesAmount: 2500,
      additionalEarnings: 0,
      grossEarnings: 49500,
      incompleteHours: 0,
      incompleteDeductionRate: 216.35,
      incompleteDeductionAmount: 0,
      otherDeductions: 0,
      totalDeductions: 0,
      netSalary: 49500,
      amountInWords: 'Forty Nine Thousand Five Hundred Rupees Only',
      presentDaysCount: 26,
      leaveDaysCount: 0,
      absentDaysCount: 0,
      eligibleWorkingHours: 216,
      payableWorkingHours: 208
    });

    const isPdf = pdfBuffer.slice(0, 4).toString() === '%PDF';
    assert(isPdf && pdfBuffer.length > 1000, `Test 7: PDF generation produced valid PDF document (${pdfBuffer.length} bytes)`);

    // TEST 8: Verified Finalized Receipt in Database
    const savedReceipt = await prisma.salaryReceipt.findFirst({
      where: { receiptNumber: 'REC-APEX-202609-APEX1002' }
    });
    assert(savedReceipt !== null && savedReceipt.netSalary === 49500, 'Test 8: Database contains finalized immutable September 2026 receipt');

    console.log(`\nTEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('Test run failed with error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
