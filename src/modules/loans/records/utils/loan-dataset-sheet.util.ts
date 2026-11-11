import { Workbook } from 'exceljs';
import { compareLoanDatasetRows } from './loan-dataset-order.util';

export interface LoanDatasetRow {
  reference: string;
  borrower: string;
  loanType: string;
  amount: number;
  returnAmount: number;
  interestRate: number;
  weeks: number;
  startDate: Date;
  endDate: Date;
  status: string;
  collateral: string;
  cleared: boolean;
  issuedBy: string;
}

const COLUMNS: Array<{ header: string; key: keyof LoanDatasetRow; width: number }> = [
  { header: 'Reference', key: 'reference', width: 38 },
  { header: 'Borrower', key: 'borrower', width: 28 },
  { header: 'Loan type', key: 'loanType', width: 22 },
  { header: 'Amount', key: 'amount', width: 14 },
  { header: 'Return amount', key: 'returnAmount', width: 16 },
  { header: 'Interest rate', key: 'interestRate', width: 14 },
  { header: 'Weeks', key: 'weeks', width: 10 },
  { header: 'Start date', key: 'startDate', width: 14 },
  { header: 'End date', key: 'endDate', width: 14 },
  { header: 'Status', key: 'status', width: 14 },
  { header: 'Collateral', key: 'collateral', width: 28 },
  { header: 'Cleared', key: 'cleared', width: 12 },
  { header: 'Issued by', key: 'issuedBy', width: 28 },
];

export async function buildLoanDatasetWorkbook(
  rows: LoanDatasetRow[],
): Promise<Buffer> {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('Loans');
  sheet.columns = COLUMNS.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width,
  }));
  sheet.getRow(1).font = { bold: true };

  const ordered = [...rows].sort(compareLoanDatasetRows);
  for (const row of ordered) {
    sheet.addRow({
      ...row,
      startDate: formatDatasetDate(row.startDate),
      endDate: formatDatasetDate(row.endDate),
      cleared: row.cleared ? 'Yes' : 'No',
    });
  }

  const bytes = await workbook.xlsx.writeBuffer();
  return Buffer.from(bytes);
}

function formatDatasetDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
