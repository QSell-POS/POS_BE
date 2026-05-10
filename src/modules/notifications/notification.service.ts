import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  NOTIFICATION_QUEUE,
  NotificationJob,
  LowStockPayload,
  ShiftReminderPayload,
  PaymentDuePayload,
} from './notification.jobs';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectQueue(NOTIFICATION_QUEUE) private readonly queue: Queue,
  ) {}

  async notifyLowStock(payload: LowStockPayload) {
    await this.queue.add(NotificationJob.LOW_STOCK, payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
      removeOnFail: 100,
    });
  }

  async notifyShiftReminder(payload: ShiftReminderPayload) {
    await this.queue.add(NotificationJob.SHIFT_REMINDER, payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
      removeOnFail: 100,
    });
  }

  async notifyPaymentDue(payload: PaymentDuePayload) {
    await this.queue.add(NotificationJob.PAYMENT_DUE, payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
      removeOnFail: 100,
    });
  }
}
