import { describe, expect, it } from '@jest/globals';
import { compareLoanDatasetRows } from './loan-dataset-order.util';

describe('loan dataset order', () => {
  const row = (
    status: string,
    start: string,
    end: string,
    reference = status,
  ) => ({
    reference,
    status,
    startDate: new Date(start),
    endDate: new Date(end),
  });

  it('groups active, then overdue, defaulted, and cleared', () => {
    const rows = [
      row('CLEARED', '2026-01-01', '2026-02-01'),
      row('OVERDUE', '2026-03-01', '2026-04-01'),
      row('ACTIVE', '2026-05-01', '2026-06-01'),
      row('DEFAULTED', '2026-02-01', '2026-03-01'),
    ];

    expect([...rows].sort(compareLoanDatasetRows).map((item) => item.status)).toEqual([
      'ACTIVE',
      'OVERDUE',
      'DEFAULTED',
      'CLEARED',
    ]);
  });

  it('puts the nearest due active loan first and the newest cleared loan first', () => {
    const rows = [
      row('ACTIVE', '2026-01-01', '2026-08-01', 'later'),
      row('ACTIVE', '2026-01-01', '2026-06-01', 'sooner'),
      row('CLEARED', '2026-01-01', '2026-02-01', 'older'),
      row('CLEARED', '2026-04-01', '2026-05-01', 'newer'),
    ];

    expect([...rows].sort(compareLoanDatasetRows).map((item) => item.reference)).toEqual([
      'sooner',
      'later',
      'newer',
      'older',
    ]);
  });
});
