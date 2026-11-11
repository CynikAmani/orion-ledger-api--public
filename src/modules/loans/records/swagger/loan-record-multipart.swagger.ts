import type { ApiBodyOptions } from '@nestjs/swagger';

export const UPDATE_LOAN_MULTIPART_BODY: ApiBodyOptions = {
  schema: {
    type: 'object',
    required: ['loanTypeId', 'loanAmount', 'interestRate', 'collateral'],
    properties: {
      loanTypeId: {
        type: 'integer',
        example: 1,
        description: 'Loan type id (loan name)',
      },
      loanAmount: { type: 'integer', example: 150000 },
      interestRate: {
        type: 'integer',
        example: 10,
        description: 'Percent snapshot stored on the loan, not live catalog',
      },
      collateral: { type: 'string', example: 'Laptop - Dell XPS' },
      file: {
        type: 'string',
        format: 'binary',
        description:
          'Optional replacement collateral image. Omit when the photo is unchanged.',
      },
    },
  },
};
