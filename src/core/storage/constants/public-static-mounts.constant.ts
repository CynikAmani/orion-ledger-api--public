/**
 * Directories under `public/` that may be served without authentication.
 * Private uploads (e.g. support ticket attachments) must NOT be listed here.
 */
export const PUBLIC_STATIC_MOUNTS = [
  { relativeDir: 'email', prefix: '/email' },
  { relativeDir: 'uploads/avatars', prefix: '/uploads/avatars' },
  { relativeDir: 'uploads/brand', prefix: '/uploads/brand' },
  { relativeDir: 'uploads/content', prefix: '/uploads/content' },
  { relativeDir: 'uploads/loans', prefix: '/uploads/loans' },
] as const;
