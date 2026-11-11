export const NOTIFICATION_TYPES = {
  ALERT: 'ALERT',
  REMINDER: 'REMINDER',
  INFO: 'INFO',
  WARNING: 'WARNING',
} as const;

export type NotificationType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export const NOTIFICATION_TYPE_VALUES = Object.values(
  NOTIFICATION_TYPES,
) as NotificationType[];
