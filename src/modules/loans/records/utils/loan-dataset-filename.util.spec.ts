import { describe, expect, it } from '@jest/globals';
import {
  buildLoanDatasetFilename,
  slugLoanDatasetBrand,
} from './loan-dataset-filename.util';

describe('loan dataset filename', () => {
  it('slugs the brand and appends a unique value', () => {
    expect(slugLoanDatasetBrand('Abale Loans')).toBe('abale-loans');
    expect(buildLoanDatasetFilename('Abale Loans', 'a1b2c3d4')).toBe(
      'abale-loans_loan-records-a1b2c3d4.xlsx',
    );
  });

  it('falls back when the brand has no filename-safe characters', () => {
    expect(buildLoanDatasetFilename('---', 'k7')).toBe(
      'institution_loan-records-k7.xlsx',
    );
  });
});
