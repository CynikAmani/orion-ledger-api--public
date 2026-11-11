/** Isolate this app's BullMQ keys from other products on a shared Redis. */
export const BULLMQ_PREFIX = 'orion';

/** App-specific queue so workers never consume another product's email jobs. */
export const EMAIL_DELIVERY_QUEUE = 'orion-email-delivery';
