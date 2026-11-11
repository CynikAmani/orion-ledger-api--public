/**
 * Canonical User identity columns.
 *
 * `id` is the immutable relation/JWT key.
 * `userId` is the public login handle (URLs and API bodies).
 *
 * Spread this into Prisma `select` objects. Do not use `userId` on FKs.
 */
export const USER_IDENTITY_SELECT = {
  id: true,
  userId: true,
} as const;
