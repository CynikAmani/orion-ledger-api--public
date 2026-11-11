/**
 * Customer-facing lender name for emails and notifications.
 * Prefer TenantBrandProfile.brandName, then Tenant.name.
 * Never fall back to the platform name — loan copy must name the issuing brand.
 */
export const FALLBACK_LENDER_DISPLAY_NAME = 'your lender';

export function resolveTenantBrandName(input: {
  tenantName?: string | null;
  brandName?: string | null;
}): string {
  const brandName = input.brandName?.trim();
  if (brandName) {
    return brandName;
  }

  const tenantName = input.tenantName?.trim();
  if (tenantName) {
    return tenantName;
  }

  return FALLBACK_LENDER_DISPLAY_NAME;
}
