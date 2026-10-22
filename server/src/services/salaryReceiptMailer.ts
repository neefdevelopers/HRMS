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

export interface GeneratedReceiptRecord {
  receiptId: string;
  receiptNumber: string;
  receipt: any;
  snapshot: ReceiptPdfData;
  pdfBuffer: Buffer;
  emailTo: string;
  employeeName: string;
  period: string;
  companyName: string;
  netSalary: number;
  currency: string;
}

/**
 * Creates/updates SalaryReceipt record and generates PDF buffer without emailing.
 */
export async function generateSalaryReceiptRecord(employeePayrollId: string): Promise<GeneratedReceiptRecord> {
  const ep = await prisma.employeePayroll.findUnique({
    where: { id: employeePayrollId },
    include: {
      employee: {
        include: {
          department: true,
          designation: true
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

  return {
    receiptId: receipt.id,
    receiptNumber: receipt.receiptNumber,
    receipt,
    snapshot,
    pdfBuffer,
    emailTo: ep.employee.email || '',
    employeeName: `${ep.employee.firstName} ${ep.employee.lastName}`,
    period: ep.payrollPeriod.period,
    companyName: ep.brand.companyName || ep.brand.name,
    netSalary: ep.netSalary,
    currency: ep.currency || 'INR'
  };
}

/**
 * Creates/updates SalaryReceipt record, generates PDF, and sends it to the employee via email.
 */
export async function makeSalaryReceiptAndSendMail(employeePayrollId: string): Promise<MakeReceiptAndMailResult> {
  const generated = await generateSalaryReceiptRecord(employeePayrollId);

  let emailResult: EmailResult = { success: false };

  if (generated.emailTo) {
    emailResult = await emailService.sendSalaryReceiptEmail({
      to: generated.emailTo,
      employeeName: generated.employeeName,
      period: generated.period,
      receiptNumber: generated.receiptNumber,
      netSalary: generated.netSalary,
      currency: generated.currency,
      companyName: generated.companyName,
      pdfBuffer: generated.pdfBuffer
    });
  } else {
    console.warn(`[SalaryReceiptMailer] Employee ${generated.employeeName} does not have an email address.`);
  }

  return {
    receiptId: generated.receiptId,
    receiptNumber: generated.receiptNumber,
    emailSent: emailResult.success,
    emailTo: generated.emailTo,
    emailPreviewUrl: emailResult.previewUrl,
    error: emailResult.error
  };
}
