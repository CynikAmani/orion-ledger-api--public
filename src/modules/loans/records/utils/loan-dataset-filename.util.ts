import { randomBytes } from 'crypto';

export function slugLoanDatasetBrand(brandName: string): string {
  const slug = brandName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug.length > 0 ? slug : 'institution';
}

export function buildLoanDatasetFilename(
  brandName: string,
  uniqueValue: string = randomBytes(4).toString('hex'),
): string {
  return `${slugLoanDatasetBrand(brandName)}_loan-records-${uniqueValue}.xlsx`;
}
