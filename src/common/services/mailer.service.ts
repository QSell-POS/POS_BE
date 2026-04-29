import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: any;

  constructor(private config: ConfigService) {
    const host = config.get<string>('mailer.host');
    const user = config.get<string>('mailer.user');
    if (host && user) {
      this.transporter = nodemailer.createTransport({
        host,
        port: config.get<number>('mailer.port'),
        secure: config.get<boolean>('mailer.secure'),
        auth: { user, pass: config.get<string>('mailer.pass') },
      });
    } else {
      this.logger.warn('SMTP not configured — emails will be logged only');
    }
  }

  async sendMail(to: string, subject: string, html: string) {
    if (!this.transporter) {
      this.logger.log(`[EMAIL SKIPPED] To: ${to} | Subject: ${subject}`);
      return;
    }
    await this.transporter.sendMail({
      from: this.config.get<string>('mailer.from'),
      to,
      subject,
      html,
    });
  }

  async sendPasswordReset(to: string, token: string, frontendUrl: string) {
    const link = `${frontendUrl}/reset-password?token=${token}`;
    await this.sendMail(
      to,
      'Reset Your Password',
      `
      <h2>Password Reset</h2>
      <p>Click the link below to reset your password. It expires in 1 hour.</p>
      <a href="${link}">${link}</a>
      <p>If you did not request this, ignore this email.</p>
    `,
    );
  }

  async sendEmailVerification(to: string, token: string, frontendUrl: string) {
    const link = `${frontendUrl}/verify-email?token=${token}`;
    await this.sendMail(
      to,
      'Verify Your Email',
      `
      <h2>Email Verification</h2>
      <p>Click the link below to verify your email address.</p>
      <a href="${link}">${link}</a>
    `,
    );
  }
}
