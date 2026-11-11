/**
 * Prefer Tenant.logoUrl; fall back to brandProfile.logoImgName (storage-relative path).
 * Returns a root-relative public path (e.g. `/uploads/brand/tenants/...`) or an absolute URL.
 */
export function resolveTenantLogoUrl(input: {
  logoUrl?: string | null;
  logoImgName?: string | null;
}): string | null {
  const candidate = input.logoUrl?.trim() || input.logoImgName?.trim() || null;
  if (!candidate) {
    return null;
  }

  if (/^https?:\/\//i.test(candidate)) {
    return candidate;
  }

  return candidate.startsWith('/') ? candidate : `/${candidate}`;
}
