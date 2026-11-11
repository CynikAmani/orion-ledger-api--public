const FALLBACK_PLATFORM_NAME = 'Orion Systems';

export function getPlatformName(): string {
  return process.env.PLATFORM_NAME?.trim() || FALLBACK_PLATFORM_NAME;
}
