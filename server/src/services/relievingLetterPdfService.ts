import PDFDocument from 'pdfkit';

export interface RelievingLetterData {
  referenceNumber: string;
  issueDate: string;
  companyName: string;
  brandName: string;
  brandAddress?: string | null;
  brandPhone?: string | null;
  brandEmail?: string | null;
  employeeName: string;
  employeeId: string;
  department: string;
  designation: string;
  branch: string;
  joiningDate: string;
  lastWorkingDay: string;
  hrRemarks?: string | null;
}

export class RelievingLetterPdfService {
  /**
   * Generates a formal, professional Relieving & Experience Letter PDF buffer using PDFKit.
   */
  async generateRelievingLetterPdf(data: RelievingLetterData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 50,
          info: {
            Title: `Relieving Letter - ${data.employeeName} (${data.employeeId})`,
            Author: data.brandName,
            Subject: `Relieving and Experience Certification for ${data.employeeName}`
          }
        });

        const buffers: Buffer[] = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err) => reject(err));

        const pageWidth = doc.page.width - 100; // 495.28 pt
        const left = 50;

        // 1. Header Banner / Letterhead
        doc.rect(left, 45, pageWidth, 65).fill('#0f172a'); // Deep slate

        doc.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold');
        doc.text(data.brandName.toUpperCase(), left + 20, 58);

        doc.fontSize(9).font('Helvetica').fillColor('#94a3b8');
        doc.text(data.companyName, left + 20, 78);
        if (data.brandAddress) {
          doc.text(data.brandAddress, left + 20, 90, { width: 280, ellipsis: true });
        }

        doc.fillColor('#38bdf8').fontSize(11).font('Helvetica-Bold');
        doc.text('OFFICIAL CERTIFICATION', left + pageWidth - 180, 58, { width: 160, align: 'right' });

        doc.fontSize(8).font('Helvetica').fillColor('#94a3b8');
        doc.text(`Ref: ${data.referenceNumber}`, left + pageWidth - 180, 76, { width: 160, align: 'right' });
        doc.text(`Date: ${data.issueDate}`, left + pageWidth - 180, 88, { width: 160, align: 'right' });

        // 2. Title Section
        let currentY = 135;
        doc.fillColor('#0f172a').fontSize(14).font('Helvetica-Bold');
        doc.text('RELIEVING & SERVICE CERTIFICATE', left, currentY, { align: 'center', width: pageWidth });

        currentY += 22;
        doc.moveTo(left + 120, currentY).lineTo(left + pageWidth - 120, currentY).strokeColor('#0284c7').lineWidth(1.5).stroke();

        // 3. Salutation
        currentY += 25;
        doc.fillColor('#1e293b').fontSize(10).font('Helvetica-Bold');
        doc.text('TO WHOMSOEVER IT MAY CONCERN', left, currentY);

        // 4. Employee Key Particulars Box
        currentY += 25;
        doc.rect(left, currentY, pageWidth, 75).fill('#f8fafc').strokeColor('#cbd5e1').lineWidth(1).stroke();

        const col1 = left + 15;
        const col2 = left + 260;
        let rowY = currentY + 12;

        const printMetaRow = (label: string, val: string, x: number, y: number) => {
          doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#475569').text(label, x, y);
          doc.fontSize(8.5).font('Helvetica').fillColor('#0f172a').text(val, x + 105, y);
        };

        printMetaRow('Employee Name:', data.employeeName, col1, rowY);
        printMetaRow('Employee ID:', data.employeeId, col2, rowY);

        rowY += 18;
        printMetaRow('Designation:', data.designation, col1, rowY);
        printMetaRow('Department:', data.department, col2, rowY);

        rowY += 18;
        printMetaRow('Joining Date:', data.joiningDate, col1, rowY);
        printMetaRow('Relieving Date:', data.lastWorkingDay, col2, rowY);

        // 5. Letter Body
        currentY += 95;
        doc.fillColor('#1e293b').fontSize(9.5).font('Helvetica').lineGap(5);

        const p1 = `This is to certify that ${data.employeeName} (Employee ID: ${data.employeeId}) was employed with ${data.brandName} (${data.companyName}) as ${data.designation} in the ${data.department} department at our ${data.branch} location from ${data.joiningDate} to ${data.lastWorkingDay}.`;
        doc.text(p1, left, currentY, { width: pageWidth, align: 'justify' });

        currentY = doc.y + 12;
        const p2 = `During their tenure with our organization, they demonstrated dedication, sincerity, and professionalism in executing their assigned responsibilities. Their conduct and character were found to be satisfactory throughout their service.`;
        doc.text(p2, left, currentY, { width: pageWidth, align: 'justify' });

        currentY = doc.y + 12;
        const p3 = `${data.employeeName} has been formally relieved from all employment duties and official services of the organization with effect from the close of business hours on ${data.lastWorkingDay}.`;
        doc.text(p3, left, currentY, { width: pageWidth, align: 'justify' });

        currentY = doc.y + 12;
        const p4 = `All company assets, equipment, intellectual property, records, and departmental handovers have been duly returned, inspected, and cleared. There are no pending claims or liabilities against them in respect of their service.`;
        doc.text(p4, left, currentY, { width: pageWidth, align: 'justify' });

        currentY = doc.y + 12;
        const p5 = `We appreciate the valuable contributions made by ${data.employeeName} during their tenure with us and wish them the very best in all their future professional and personal endeavors.`;
        doc.text(p5, left, currentY, { width: pageWidth, align: 'justify' });

        // 6. Signoff and Signature Area
        currentY = doc.y + 35;
        doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text(`For ${data.brandName}`, left, currentY);

        currentY += 14;
        doc.fontSize(8.5).font('Helvetica').fillColor('#64748b');
        doc.text(`(A unit of ${data.companyName})`, left, currentY);

        currentY += 45;
        doc.moveTo(left, currentY).lineTo(left + 160, currentY).strokeColor('#94a3b8').lineWidth(1).stroke();

        currentY += 6;
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('Authorized Signatory', left, currentY);

        currentY += 12;
        doc.fontSize(8.5).font('Helvetica').fillColor('#475569');
        doc.text('Human Resources Department', left, currentY);

        // 7. Footer Seal & Verification Note
        const footerY = doc.page.height - 65;
        doc.moveTo(left, footerY).lineTo(left + pageWidth, footerY).strokeColor('#e2e8f0').lineWidth(0.8).stroke();

        doc.fontSize(7.5).font('Helvetica').fillColor('#94a3b8');
        doc.text(
          'This is a system-generated official document issued by the Human Resource Management System. Verification can be performed by referencing the document Ref Number.',
          left,
          footerY + 8,
          { width: pageWidth, align: 'center' }
        );

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}

export const relievingLetterPdfService = new RelievingLetterPdfService();
