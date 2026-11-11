import { describe, expect, it } from '@jest/globals';
import { Workbook } from 'exceljs';
import { buildLoanDatasetWorkbook } from './loan-dataset-sheet.util';

describe('loan dataset sheet', () => {
  it('writes loan fields only, grouped by status', async () => {
    const bytes = await buildLoanDatasetWorkbook([
      {
        reference: 'cleared-1',
        borrower: 'Ada',
        loanType: 'Weekly',
        amount: 1000,
        returnAmount: 1100,
        interestRate: 10,
        weeks: 4,
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-02-01T00:00:00.000Z'),
        status: 'CLEARED',
        collateral: 'Phone',
        cleared: true,
        issuedBy: 'Paul',
      },
      {
        reference: 'active-1',
        borrower: 'Ben',
        loanType: 'Weekly',
        amount: 2000,
        returnAmount: 2200,
        interestRate: 10,
        weeks: 4,
        startDate: new Date('2026-05-01T00:00:00.000Z'),
        endDate: new Date('2026-06-01T00:00:00.000Z'),
        status: 'ACTIVE',
        collateral: 'Bike',
        cleared: false,
        issuedBy: 'Paul',
      },
    ]);

    const workbook = new Workbook();
    const payload = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(payload).set(bytes);
    await workbook.xlsx.load(payload);
    const sheet = workbook.getWorksheet('Loans');
    const headers = sheet?.getRow(1).values;

    expect(headers).toEqual([
      undefined,
      'Reference',
      'Borrower',
      'Loan type',
      'Amount',
      'Return amount',
      'Interest rate',
      'Weeks',
      'Start date',
      'End date',
      'Status',
      'Collateral',
      'Cleared',
      'Issued by',
    ]);
    expect(sheet?.getRow(2).getCell(1).value).toBe('active-1');
    expect(sheet?.getRow(2).getCell(10).value).toBe('ACTIVE');
    expect(sheet?.getRow(3).getCell(1).value).toBe('cleared-1');
    expect(JSON.stringify(headers)).not.toMatch(/Id|repayment/i);
  });
});
