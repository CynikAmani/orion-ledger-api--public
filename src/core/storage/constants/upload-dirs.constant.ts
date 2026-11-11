export const UPLOAD_DIRS = {
  AVATARS: 'uploads/avatars',
  BRAND: 'uploads/brand',
  /** Tenant brand logos — under uploads/brand so the existing public static mount applies. */
  BRAND_TENANT: 'uploads/brand/tenants',
  ADVERTS: 'uploads/content/adverts',
  BRAND_SHOWCASES: 'uploads/content/brand-showcases',
  SUPPORT_TICKETS: 'uploads/support/tickets',
  LOAN_APPLICATION_COLLATERAL: 'uploads/loans/applications/collateral',
  /** Covered by the existing `uploads/loans` public static mount. */
  LOAN_RECORD_COLLATERAL: 'uploads/loans/records/collateral',
  IDENTITY_DOCUMENTS: 'uploads/identity-documents',
} as const;

export const IMAGE_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

export const IMAGE_UPLOAD_MIME_PATTERN = /^image\/(jpeg|png|webp|gif)$/;

export const IMAGE_EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

export const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

/** Support ticket attachments — jpeg/png/webp only (no gif). */
export const SUPPORT_TICKET_IMAGE_MIME_PATTERN = /^image\/(jpeg|png|webp)$/;
