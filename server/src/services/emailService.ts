import nodemailer, { Transporter } from 'nodemailer';

export interface SendSalaryReceiptEmailOptions {
  to: string;
  employeeName: string;
  period: string;
  receiptNumber: string;
  netSalary: number;
  currency?: string;
  companyName?: string;
  pdfBuffer: Buffer;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  previewUrl?: string | false;
  error?: string;
}

class EmailService {
  private transporter: Transporter | null = null;
  private isTestAccount = false;

  private async getTransporter(): Promise<Transporter> {
    if (this.transporter) return this.transporter;

    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user, pass }
      });
      console.log(`[EmailService] Configured live SMTP transport with host: ${host}`);
    } else {
      // Create ethereal test account for development/demo
      try {
        const testAccount = await nodemailer.createTestAccount();
        this.transporter = nodemailer.createTransport({
          host: testAccount.smtp.host,
          port: testAccount.smtp.port,
          secure: testAccount.smtp.secure,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass
          }
        });
        this.isTestAccount = true;
        console.log(`[EmailService] Using Ethereal test mail transporter (User: ${testAccount.user})`);
      } catch (err) {
        console.warn('[EmailService] Failed to create test account, using JSON/stream transporter fallback', err);
        this.transporter = nodemailer.createTransport({
          jsonTransport: true
        });
      }
    }

    return this.transporter;
  }

  /**
   * Send salary receipt email with attached PDF payslip
   */
  async sendSalaryReceiptEmail(options: SendSalaryReceiptEmailOptions): Promise<EmailResult> {
    try {
      const transporter = await this.getTransporter();
      const currency = options.currency || 'INR';
      const company = options.companyName || 'Apex Omnichannel Retail Enterprises';
      const formattedSalary = options.netSalary.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
            .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 32px 24px; text-align: center; color: #ffffff; }
            .header h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
            .header p { margin: 6px 0 0; font-size: 13px; opacity: 0.9; }
            .content { padding: 32px 24px; }
            .greeting { font-size: 15px; font-weight: 600; margin-bottom: 12px; }
            .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
            .row:last-child { margin-bottom: 0; }
            .label { color: #64748b; }
            .value { font-weight: 600; color: #0f172a; }
            .total-row { border-top: 2px dashed #cbd5e1; margin-top: 12px; padding-top: 12px; }
            .total-value { font-size: 18px; color: #15803d; font-weight: 700; }
            .notice { font-size: 12px; color: #64748b; line-height: 1.5; margin-top: 24px; }
            .footer { background: #f1f5f9; padding: 16px 24px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${company}</h1>
              <p>Monthly Salary Receipt for Period ${options.period}</p>
            </div>
            <div class="content">
              <div class="greeting">Dear ${options.employeeName},</div>
              <p style="font-size: 13px; color: #475569; line-height: 1.6;">
                Your salary calculation for the period <strong>${options.period}</strong> has been finalized. 
                Your official salary receipt is attached to this email as a PDF document.
              </p>

              <div class="card">
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Receipt Number:</td>
                    <td style="padding: 6px 0; font-weight: 600; text-align: right; font-family: monospace;">${options.receiptNumber}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Payroll Period:</td>
                    <td style="padding: 6px 0; font-weight: 600; text-align: right;">${options.period}</td>
                  </tr>
                  <tr style="border-top: 1px solid #e2e8f0;">
                    <td style="padding: 12px 0 6px; font-weight: 700; color: #1e293b;">Net Payable Salary:</td>
                    <td style="padding: 12px 0 6px; font-weight: 800; font-size: 16px; color: #15803d; text-align: right;">
                      ₹${formattedSalary} ${currency}
                    </td>
                  </tr>
                </table>
              </div>

              <p class="notice">
                Please retain this receipt for your records. If you have any inquiries regarding your salary breakdown, deductions, or overtime calculations, please contact the HR department.
              </p>
            </div>
            <div class="footer">
              This is an automated payroll notification from ${company} HRMS. Please do not reply directly to this email.
            </div>
          </div>
        </body>
        </html>
      `;

      const fromAddress = process.env.SMTP_FROM || `"${company} Payroll" <payroll@hrms.local>`;

      const info = await transporter.sendMail({
        from: fromAddress,
        to: options.to,
        subject: `Salary Receipt - ${options.period} | ${options.employeeName} (${options.receiptNumber})`,
        text: `Dear ${options.employeeName},\n\nYour salary receipt for ${options.period} has been generated.\n\nReceipt Number: ${options.receiptNumber}\nNet Payable Salary: ₹${formattedSalary}\n\nPlease find your official PDF receipt attached.\n\nRegards,\n${company} Payroll Department`,
        html: htmlContent,
        attachments: [
          {
            filename: `Salary_Receipt_${options.receiptNumber}.pdf`,
            content: options.pdfBuffer,
            contentType: 'application/pdf'
          }
        ]
      });

      let previewUrl: string | false = false;
      if (this.isTestAccount) {
        previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
          console.log(`[EmailService] Preview sent email at: ${previewUrl}`);
        }
      }

      console.log(`[EmailService] Successfully sent salary receipt to ${options.to} (MessageId: ${info.messageId})`);
      return {
        success: true,
        messageId: info.messageId,
        previewUrl
      };
    } catch (err: any) {
      console.error(`[EmailService] Failed to send email to ${options.to}:`, err.message);
      return {
        success: false,
        error: err.message
      };
    }
  }
}

export const emailService = new EmailService();
