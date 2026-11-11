export const PAYCHANGU_MODE = {
  TEST: 'test',
  LIVE: 'live',
} as const;

export type PaychanguMode =
  (typeof PAYCHANGU_MODE)[keyof typeof PAYCHANGU_MODE];
