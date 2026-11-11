export const TENANT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const TENANT_SLUG_MESSAGE =
  'slug must be lowercase kebab-case (e.g. acme-finance)';

export const TENANT_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]*$/;
export const TENANT_CODE_MESSAGE =
  'tenantCode must start with a letter or digit and use only A-Z, 0-9, _ or -';
