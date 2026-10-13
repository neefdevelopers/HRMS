import { prisma } from '../config/prisma.js';
import { receiptPdfService, ReceiptPdfData } from './receiptPdfService.js';
import { emailService, EmailResult } from './emailService.js';
import { numberToIndianCurrencyWords } from '../utils/numberToWords.js';

export interface MakeReceiptAndMailResult {
  receiptId: string;
  receiptNumber: string;
  emailSent: boolean;
  emailTo: string;
  emailPreviewUrl?: string | false;
  error?: string;
}

/**
 * Creates/updates SalaryReceipt record, generates PDF, and sends it to the employee via email.
 */
export async function makeSalaryReceiptAndSendMail(employeePayrollId: string): Promise<MakeReceiptAndMailResult> {
  const ep = await prisma.employeePayroll.findUnique({
    where: { id: employeePayrollId },
    include: {
      employee: {
        include: {
          department: true,
          designation: true,
          branch: true
        }
      },
      brand: true,
      payrollPeriod: true
    }
  });

  if (!ep) {
    throw new Error(`Employee payroll record not found: ${employeePayrollId}`);
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const periodClean = ep.payrollPeriod.period.replace('-', '');
  const brandCode = ep.brand.code || 'HRMS';
  const receiptNumber = `REC-${brandCode}-${periodClean}-${ep.employee.employeeId}`;
  const amountInWords = numberToIndianCurrencyWords(ep.netSalary);

  const snapshot: ReceiptPdfData = {
    receiptNumber,
    issueDate: todayStr,
    paymentDate: todayStr,
    payrollPeriod: ep.payrollPeriod.period,
    companyName: ep.brand.companyName || ep.brand.name,
    brandName: ep.brand.name,
    brandAddress: ep.brand.address,
    brandPhone: ep.brand.phone,
    brandEmail: ep.brand.email,
    employeeName: `${ep.employee.firstName} ${ep.employee.lastName}`,
    employeeId: ep.employee.employeeId,
    department: ep.employee.department?.name || 'General',
    designation: ep.employee.designation?.title || 'Staff',
    branch: ep.employee.branch?.name || 'Headquarters',
    joiningDate: ep.employee.joiningDate,
    currency: ep.currency || 'INR',
    baseSalary: ep.baseSalary,
    payableSalary: ep.payableSalary,
    isProrated: ep.baseSalary !== ep.payableSalary,
    approvedOtHours: ep.approvedOtHours,
    otRate: ep.otRate,
    otPayment: ep.otPayment,
    approvedIncentivesAmount: ep.approvedIncentivesAmount,
    additionalEarnings: ep.additionalEarnings,
    grossEarnings: ep.grossEarnings,
    incompleteHours: ep.incompleteHours,
    incompleteDeductionRate: ep.incompleteDeductionRate,
    incompleteDeductionAmount: ep.incompleteDeductionAmount,
    otherDeductions: ep.otherDeductions,
    totalDeductions: ep.totalDeductions,
    netSalary: ep.netSalary,
    amountInWords,
    presentDaysCount: ep.presentDaysCount,
    leaveDaysCount: ep.leaveDaysCount,
    absentDaysCount: ep.absentDaysCount,
    eligibleWorkingHours: ep.eligibleWorkingHours,
    payableWorkingHours: ep.payableWorkingHours
  };

  // 1. Create or update the SalaryReceipt in the database
  const receipt = await prisma.salaryReceipt.upsert({
    where: { employeePayrollId: ep.id },
    create: {
      employeePayrollId: ep.id,
      receiptNumber,
      issueDate: todayStr,
      paymentDate: todayStr,
      netSalary: ep.netSalary,
      amountInWords,
      snapshotJson: JSON.stringify(snapshot)
    },
    update: {
      netSalary: ep.netSalary,
      amountInWords,
      snapshotJson: JSON.stringify(snapshot)
    }
  });

  // 2. Generate PDF document buffer
  const pdfBuffer = await receiptPdfService.generateSalaryReceiptPdf(snapshot);

  // 3. Send email to employee with the generated PDF attached
  const emailTo = ep.employee.email;
  let emailResult: EmailResult = { success: false };

  if (emailTo) {
    emailResult = await emailService.sendSalaryReceiptEmail({
      to: emailTo,
      employeeName: `${ep.employee.firstName} ${ep.employee.lastName}`,
      period: ep.payrollPeriod.period,
      receiptNumber,
      netSalary: ep.netSalary,
      currency: ep.currency,
      companyName: ep.brand.companyName || ep.brand.name,
      pdfBuffer
    });
  } else {
    console.warn(`[SalaryReceiptMailer] Employee ${ep.employee.employeeId} does not have an email address.`);
  }

  return {
    receiptId: receipt.id,
    receiptNumber: receipt.receiptNumber,
    emailSent: emailResult.success,
    emailTo,
    emailPreviewUrl: emailResult.previewUrl,
    error: emailResult.error
  };
}
