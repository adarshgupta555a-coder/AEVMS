import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { env } from "../config/env.js";

export interface SendInvitationEmailParams {
  to: string;
  clientName: string;
  activationUrl: string;
  expiresInHours: number;
}

export class EmailService {
  private transporter: Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter(): void {
    if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
      });
      console.log(`[EmailService] Nodemailer SMTP Transporter initialized (${env.SMTP_HOST}:${env.SMTP_PORT})`);
    } else {
      this.transporter = null;
      console.log("[EmailService] SMTP credentials not set. Falling back to console logger in development.");
    }
  }

  /**
   * Sends an account activation invitation email to the client using Nodemailer SMTP.
   * If SMTP is not yet configured in development, logs the link clearly to the console.
   */
  async sendPortalInvitation(
    params: SendInvitationEmailParams
  ): Promise<{ delivered: boolean; messageId?: string; error?: string }> {
    const subject = "Activate Your Event Management Client Portal";

    const textContent = `
Hello ${params.clientName},

You have been granted access to your Event Management Client Portal.
Please activate your portal and choose your password using the link below:

${params.activationUrl}

This link will expire in ${params.expiresInHours} hours.
If you did not request this, please contact our team.

Best regards,
EMS Team
`.trim();

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6; margin: 0; padding: 20px; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 32px; border: 1px solid #e2e8f0; }
    .header { font-size: 22px; font-weight: 700; color: #0f172a; margin-bottom: 16px; }
    .btn { display: inline-block; padding: 12px 28px; font-size: 15px; font-weight: 600; color: #ffffff !important; background-color: #2563eb; text-decoration: none; border-radius: 6px; margin: 24px 0; }
    .footer { font-size: 13px; color: #64748b; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">Welcome to Event Management Portal</div>
    <p>Hello <strong>${params.clientName}</strong>,</p>
    <p>You have been assigned access to your online Client Portal. From your portal, you can review event schedules, invoices, and payment receipts.</p>
    <p>Please click the button below to choose your password and activate your account:</p>
    <div>
      <a href="${params.activationUrl}" class="btn" target="_blank">Activate My Portal</a>
    </div>
    <p>Or copy and paste this link in your browser:<br><a href="${params.activationUrl}">${params.activationUrl}</a></p>
    <div class="footer">
      <p>This single-use activation link is valid for <strong>${params.expiresInHours} hours</strong>.<br>If you did not expect this invitation, please disregard this email.</p>
    </div>
  </div>
</body>
</html>
`.trim();

    try {
      if (this.transporter) {
        const info = await this.transporter.sendMail({
          from: env.SMTP_FROM,
          to: params.to,
          subject,
          text: textContent,
          html: htmlContent,
        });

        console.log(`[EmailService] Invitation email delivered successfully via SMTP to ${params.to} (MessageId: ${info.messageId})`);
        return { delivered: true, messageId: info.messageId };
      }

      // Development / test fallback when SMTP is not configured
      console.log("\n========================================================");
      console.log(`[EmailService - Nodemailer Console Fallback]`);
      console.log(`To:          ${params.to}`);
      console.log(`Subject:     ${subject}`);
      console.log(`Expires in:  ${params.expiresInHours} hours`);
      console.log(`Action Link: ${params.activationUrl}`);
      console.log("========================================================\n");

      return { delivered: true };
    } catch (error: any) {
      console.error(`[EmailService] Failed to send email to ${params.to} via SMTP:`, error);
      return { delivered: false, error: error.message };
    }
  }
}

export const emailService = new EmailService();
