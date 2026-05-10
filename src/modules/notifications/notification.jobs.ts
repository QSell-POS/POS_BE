export const NOTIFICATION_QUEUE = 'notifications';

export const NotificationJob = {
  LOW_STOCK:       'low-stock',
  SHIFT_REMINDER:  'shift-reminder',
  PAYMENT_DUE:     'payment-due',
} as const;

export type NotificationJobName = typeof NotificationJob[keyof typeof NotificationJob];

// ── Job payloads ──────────────────────────────────────────────────────────────

export interface LowStockPayload {
  shopId:      string;
  productName: string;
  variantSku:  string;
  current:     number;
  minimum:     number;
  adminEmail:  string;
}

export interface ShiftReminderPayload {
  shopId:    string;
  shiftId:   string;
  openedBy:  string;
  openedAt:  string;
  adminEmail: string;
}

export interface PaymentDuePayload {
  shopId:       string;
  customerName: string;
  customerEmail: string | null;
  amountDue:    number;
  adminEmail:   string;
}
