import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { Logger } from '@nestjs/common';
import { MailerService } from 'src/common/services/mailer.service';
import {
  NOTIFICATION_QUEUE,
  NotificationJob,
  LowStockPayload,
  ShiftReminderPayload,
  PaymentDuePayload,
} from './notification.jobs';

@Processor(NOTIFICATION_QUEUE)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private readonly mailer: MailerService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case NotificationJob.LOW_STOCK:
        return this.handleLowStock(job.data as LowStockPayload);
      case NotificationJob.SHIFT_REMINDER:
        return this.handleShiftReminder(job.data as ShiftReminderPayload);
      case NotificationJob.PAYMENT_DUE:
        return this.handlePaymentDue(job.data as PaymentDuePayload);
      default:
        throw new UnrecoverableError(`Unknown job: ${job.name}`);
    }
  }

  // ── Low stock ─────────────────────────────────────────────────────────────

  private async handleLowStock(data: LowStockPayload) {
    this.logger.warn(`Low stock: ${data.variantSku} — ${data.current}/${data.minimum}`);
    await this.mailer.sendMail(
      data.adminEmail,
      `⚠️ Low Stock Alert: ${data.productName}`,
      `
        <h2>Low Stock Alert</h2>
        <p>The following product is running low on stock:</p>
        <table>
          <tr><td><b>Product</b></td><td>${data.productName}</td></tr>
          <tr><td><b>SKU</b></td><td>${data.variantSku}</td></tr>
          <tr><td><b>Current Stock</b></td><td>${data.current}</td></tr>
          <tr><td><b>Minimum Level</b></td><td>${data.minimum}</td></tr>
        </table>
        <p>Please restock soon.</p>
      `,
    );
  }

  // ── Shift reminder ────────────────────────────────────────────────────────

  private async handleShiftReminder(data: ShiftReminderPayload) {
    this.logger.warn(`Open shift reminder: ${data.shiftId} opened by ${data.openedBy}`);
    await this.mailer.sendMail(
      data.adminEmail,
      `🕐 Open Shift Reminder`,
      `
        <h2>Shift Still Open</h2>
        <p>A shift has been open for a long time and may need to be closed.</p>
        <table>
          <tr><td><b>Opened By</b></td><td>${data.openedBy}</td></tr>
          <tr><td><b>Opened At</b></td><td>${data.openedAt}</td></tr>
        </table>
        <p>Please close the shift if the business day has ended.</p>
      `,
    );
  }

  // ── Payment due ───────────────────────────────────────────────────────────

  private async handlePaymentDue(data: PaymentDuePayload) {
    this.logger.log(`Payment due: ${data.customerName} owes ${data.amountDue}`);

    // Notify admin
    await this.mailer.sendMail(
      data.adminEmail,
      `💰 Payment Due: ${data.customerName}`,
      `
        <h2>Outstanding Payment</h2>
        <p><b>${data.customerName}</b> has an outstanding balance of <b>Rs. ${data.amountDue}</b>.</p>
        <p>Please follow up with the customer.</p>
      `,
    );

    // Notify customer if they have an email
    if (data.customerEmail) {
      await this.mailer.sendMail(
        data.customerEmail,
        `Payment Reminder`,
        `
          <h2>Payment Reminder</h2>
          <p>Dear ${data.customerName},</p>
          <p>You have an outstanding balance of <b>Rs. ${data.amountDue}</b>.</p>
          <p>Please visit us or contact us to clear your dues.</p>
        `,
      );
    }
  }
}
