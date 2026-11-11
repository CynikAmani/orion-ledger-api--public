import type { ApiBodyOptions } from '@nestjs/swagger';

export const CREATE_LOAN_APPLICATION_MULTIPART_BODY: ApiBodyOptions = {
  schema: {
    type: 'object',
    required: ['tenantIdentifier', 'loanAmount', 'numWeeks', 'location'],
    properties: {
      tenantIdentifier: {
        type: 'string',
        example: 'abale-loans',
        description: 'Tenant slug or tenant code of the issuing institution',
      },
      loanAmount: { type: 'integer', example: 150000 },
      collateral: { type: 'string', example: 'Laptop - Dell XPS' },
      numWeeks: { type: 'integer', example: 4 },
      location: { type: 'string', example: 'Lilongwe' },
      offerId: { type: 'integer', example: 12 },
      file: {
        type: 'string',
        format: 'binary',
        description: 'Optional collateral image',
      },
    },
  },
};

export const UPDATE_LOAN_APPLICATION_MULTIPART_BODY: ApiBodyOptions = {
  schema: {
    type: 'object',
    properties: {
      loanAmount: { type: 'integer' },
      collateral: { type: 'string' },
      numWeeks: { type: 'integer' },
      location: { type: 'string' },
      offerId: {
        type: 'integer',
        nullable: true,
        description: 'Omit to leave unchanged; send null/empty to detach offer',
      },
      file: {
        type: 'string',
        format: 'binary',
        description: 'Optional replacement collateral image',
      },
    },
  },
};
