import PDFDocument from 'pdfkit';
import { numberToIndianCurrencyWords } from '../utils/numberToWords.js';

export interface ReceiptPdfData {
  receiptNumber: string;
  issueDate: string;
  paymentDate?: string | null;
  payrollPeriod: string; // e.g. "2026-10"
  companyName: string;
  brandName: string;
  brandAddress?: string | null;
  brandPhone?: string | null;
  brandEmail?: string | null;
  employeeName: string;
  employeeId: string;
  department: string;
  designation: string;
  joiningDate: string;
  currency: string;

  // Earnings
  baseSalary: number;
  payableSalary: number;
  isProrated: boolean;
  prorationReason?: string;
  approvedOtHours: number;
  otRate: number;
  otPayment: number;
  approvedIncentivesAmount: number;
  incentivesList?: Array<{ title: string; calculatedAmount: number }>;
  additionalEarnings: number;
  grossEarnings: number;

  // Deductions
  incompleteHours: number;
  incompleteDeductionRate: number;
  incompleteDeductionAmount: number;
  otherDeductions: number;
  totalDeductions: number;

  // Summary
  netSalary: number;
  amountInWords: string;

  // Working stats
  presentDaysCount: number;
  leaveDaysCount: number;
  absentDaysCount: number;
  eligibleWorkingHours: number;
  payableWorkingHours: number;
}

export class ReceiptPdfService {
  /**
   * Generates a Salary Receipt PDF buffer using PDFKit.
   */
  async generateSalaryReceiptPdf(data: ReceiptPdfData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 40,
          info: {
            Title: `Salary Receipt - ${data.receiptNumber}`,
            Author: data.brandName,
            Subject: `Salary Receipt for ${data.employeeName} (${data.payrollPeriod})`
          }
        });

        const buffers: Buffer[] = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err) => reject(err));

        const pageWidth = doc.page.width - 80; // 515.28 pt
        const left = 40;

        // 1. Header Banner
        doc.rect(left, 40, pageWidth, 60).fill('#0f172a'); // Slate-900

        doc.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold');
        doc.text(data.brandName.toUpperCase(), left + 20, 52);

        doc.fontSize(9).font('Helvetica').fillColor('#94a3b8');
        doc.text(data.companyName, left + 20, 72);

        doc.fillColor('#ffffff').fontSize(12).font('Helvetica-Bold');
        doc.text('SALARY RECEIPT', left + pageWidth - 160, 52, { width: 140, align: 'right' });

        doc.fontSize(8).font('Helvetica').fillColor('#94a3b8');
        doc.text(`Ref: ${data.receiptNumber}`, left + pageWidth - 160, 70, { width: 140, align: 'right' });
        doc.text(`Period: ${data.payrollPeriod}`, left + pageWidth - 160, 82, { width: 140, align: 'right' });

        // 2. Employee & Organization Metadata Cards
        let currentY = 115;
        doc.rect(left, currentY, pageWidth, 85).fill('#f8fafc').stroke('#e2e8f0');

        doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold');
        doc.text('EMPLOYEE DETAILS', left + 15, currentY + 10);
        doc.text('PAYMENT DETAILS', left + (pageWidth / 2) + 15, currentY + 10);

        doc.strokeColor('#cbd5e1').lineWidth(0.5);
        doc.moveTo(left + (pageWidth / 2), currentY + 8).lineTo(left + (pageWidth / 2), currentY + 77).stroke();

        doc.font('Helvetica').fontSize(8.5).fillColor('#475569');

        // Column 1
        doc.text(`Name:`, left + 15, currentY + 26);
        doc.font('Helvetica-Bold').fillColor('#0f172a').text(data.employeeName, left + 85, currentY + 26);
        
        doc.font('Helvetica').fillColor('#475569').text(`Employee ID:`, left + 15, currentY + 40);
        doc.font('Helvetica-Bold').fillColor('#0f172a').text(data.employeeId, left + 85, currentY + 40);

        doc.font('Helvetica').fillColor('#475569').text(`Department:`, left + 15, currentY + 54);
        doc.font('Helvetica').fillColor('#0f172a').text(data.department, left + 85, currentY + 54);

        doc.font('Helvetica').fillColor('#475569').text(`Designation:`, left + 15, currentY + 68);
        doc.font('Helvetica').fillColor('#0f172a').text(data.designation, left + 85, currentY + 68);

        // Column 2
        doc.font('Helvetica').fillColor('#475569').text(`Brand:`, left + (pageWidth / 2) + 15, currentY + 26);
        doc.font('Helvetica').fillColor('#0f172a').text(data.brandName, left + (pageWidth / 2) + 85, currentY + 26);

        doc.font('Helvetica').fillColor('#475569').text(`Issue Date:`, left + (pageWidth / 2) + 15, currentY + 40);
        doc.font('Helvetica').fillColor('#0f172a').text(data.issueDate, left + (pageWidth / 2) + 85, currentY + 40);

        doc.font('Helvetica').fillColor('#475569').text(`Payment Date:`, left + (pageWidth / 2) + 15, currentY + 54);
        doc.font('Helvetica').fillColor('#0f172a').text(data.paymentDate || 'Processed', left + (pageWidth / 2) + 85, currentY + 54);

        doc.font('Helvetica').fillColor('#475569').text(`Work Hours:`, left + (pageWidth / 2) + 15, currentY + 68);
        doc.font('Helvetica').fillColor('#0f172a').text(`${data.eligibleWorkingHours} hrs / ${data.payableWorkingHours} hrs expected`, left + (pageWidth / 2) + 85, currentY + 68);

        // 3. Earnings & Deductions Tables side-by-side
        currentY = 215;
        const colWidth = (pageWidth - 15) / 2;
        const rightColLeft = left + colWidth + 15;

        // --- Earnings Header ---
        doc.rect(left, currentY, colWidth, 24).fill('#1e293b');
        doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
        doc.text('EARNINGS', left + 10, currentY + 7);
        doc.text(`AMOUNT (${data.currency})`, left + colWidth - 95, currentY + 7, { width: 85, align: 'right' });

        // --- Deductions Header ---
        doc.rect(rightColLeft, currentY, colWidth, 24).fill('#1e293b');
        doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
        doc.text('DEDUCTIONS', rightColLeft + 10, currentY + 7);
        doc.text(`AMOUNT (${data.currency})`, rightColLeft + colWidth - 95, currentY + 7, { width: 85, align: 'right' });

        currentY += 24;
        let earningsY = currentY;
        let deductionsY = currentY;

        // Populate Earnings Items
        const renderItem = (x: number, y: number, label: string, sub: string | null, amount: number) => {
          doc.rect(x, y, colWidth, 28).fill(y % 2 === 0 ? '#f8fafc' : '#ffffff').stroke('#f1f5f9');
          doc.font('Helvetica-Bold').fontSize(8).fillColor('#1e293b').text(label, x + 10, y + 6);
          if (sub) {
            doc.font('Helvetica').fontSize(6.5).fillColor('#64748b').text(sub, x + 10, y + 16);
          }
          doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a').text(
            amount.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
            x + colWidth - 90,
            y + 9,
            { width: 80, align: 'right' }
          );
          return y + 28;
        };

        // Fixed Salary
        earningsY = renderItem(
          left,
          earningsY,
          'Basic Fixed Salary',
          data.isProrated ? `Prorated: ${data.prorationReason || 'Mid-month adjustment'}` : 'Standard monthly basis',
          data.payableSalary
        );

        // Overtime
        earningsY = renderItem(
          left,
          earningsY,
          'Overtime (OT) Pay',
          `${data.approvedOtHours} hrs @ ₹${data.otRate.toFixed(2)}/hr`,
          data.otPayment
        );

        // Incentives
        if (data.incentivesList && data.incentivesList.length > 0) {
          for (const inc of data.incentivesList) {
            earningsY = renderItem(
              left,
              earningsY,
              `Incentive: ${inc.title}`,
              'Approved Performance / Spot Bonus',
              inc.calculatedAmount
            );
          }
        } else if (data.approvedIncentivesAmount > 0) {
          earningsY = renderItem(
            left,
            earningsY,
            'Performance Incentives',
            'Approved incentive bonus',
            data.approvedIncentivesAmount
          );
        }

        // Additional Earnings
        if (data.additionalEarnings > 0) {
          earningsY = renderItem(
            left,
            earningsY,
            'Additional Earnings',
            'Special adjustments',
            data.additionalEarnings
          );
        }

        // Deductions Items
        // Incomplete hours deduction
        deductionsY = renderItem(
          rightColLeft,
          deductionsY,
          'Incomplete Working Hours',
          `${data.incompleteHours} hrs @ ₹${data.incompleteDeductionRate.toFixed(2)}/hr`,
          data.incompleteDeductionAmount
        );

        // Other deductions
        if (data.otherDeductions > 0) {
          deductionsY = renderItem(
            rightColLeft,
            deductionsY,
            'Other Deductions',
            'Authorized payroll adjustment',
            data.otherDeductions
          );
        }

        // Equalize heights
        const maxY = Math.max(earningsY, deductionsY);
        while (earningsY < maxY) {
          earningsY = renderItem(left, earningsY, '-', null, 0);
        }
        while (deductionsY < maxY) {
          deductionsY = renderItem(rightColLeft, deductionsY, '-', null, 0);
        }

        // Total Earnings bar
        doc.rect(left, earningsY, colWidth, 24).fill('#e2e8f0');
        doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold');
        doc.text('TOTAL EARNINGS', left + 10, earningsY + 7);
        doc.text(
          data.grossEarnings.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
          left + colWidth - 90,
          earningsY + 7,
          { width: 80, align: 'right' }
        );

        // Total Deductions bar
        doc.rect(rightColLeft, deductionsY, colWidth, 24).fill('#e2e8f0');
        doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold');
        doc.text('TOTAL DEDUCTIONS', rightColLeft + 10, deductionsY + 7);
        doc.text(
          data.totalDeductions.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
          rightColLeft + colWidth - 90,
          deductionsY + 7,
          { width: 80, align: 'right' }
        );

        currentY = maxY + 35;

        // 4. Net Salary Highlight Banner
        doc.rect(left, currentY, pageWidth, 56).fill('#047857'); // Emerald-700

        doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold');
        doc.text('NET PAYABLE SALARY', left + 20, currentY + 12);

        doc.fontSize(8.5).font('Helvetica').fillColor('#d1fae5');
        doc.text(data.amountInWords || numberToIndianCurrencyWords(data.netSalary), left + 20, currentY + 30, {
          width: pageWidth - 180
        });

        doc.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold');
        doc.text(
          `₹ ${data.netSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
          left + pageWidth - 160,
          currentY + 18,
          { width: 140, align: 'right' }
        );

        currentY += 70;

        // 5. Attendance Summary Badge
        doc.rect(left, currentY, pageWidth, 40).fill('#f8fafc').stroke('#e2e8f0');
        doc.fillColor('#64748b').fontSize(7.5).font('Helvetica-Bold');
        doc.text('MONTHLY ATTENDANCE AUDIT SNAPSHOT:', left + 15, currentY + 8);

        doc.font('Helvetica').fontSize(8).fillColor('#334155');
        const statsText = `Days Present: ${data.presentDaysCount}   |   Approved Leaves: ${data.leaveDaysCount}   |   Days Absent: ${data.absentDaysCount}   |   Logged Hours: ${data.eligibleWorkingHours} hrs   |   Overtime: ${data.approvedOtHours} hrs`;
        doc.text(statsText, left + 15, currentY + 22);

        currentY += 55;

        // 6. Signatures and Verification
        doc.strokeColor('#cbd5e1').lineWidth(0.5);
        doc.moveTo(left, currentY + 35).lineTo(left + 160, currentY + 35).stroke();
        doc.moveTo(left + pageWidth - 160, currentY + 35).lineTo(left + pageWidth, currentY + 35).stroke();

        doc.fontSize(7.5).font('Helvetica').fillColor('#64748b');
        doc.text('Employee Signature', left, currentY + 40, { width: 160, align: 'center' });
        doc.text('Authorized HR Signatory', left + pageWidth - 160, currentY + 40, { width: 160, align: 'center' });

        // 7. Footer Disclaimer
        doc.fontSize(7).font('Helvetica').fillColor('#94a3b8');
        doc.text(
          'This is a system-generated salary statement issued by HRMS Multi-Brand Enterprise. It certifies the net salary computation based on verified attendance logs and approved policy configurations.',
          left,
          currentY + 68,
          { width: pageWidth, align: 'center' }
        );

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}

export const receiptPdfService = new ReceiptPdfService();
