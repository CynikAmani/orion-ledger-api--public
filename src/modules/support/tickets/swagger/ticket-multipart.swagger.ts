import type { ApiBodyOptions } from '@nestjs/swagger';

export const CREATE_SUPPORT_TICKET_MULTIPART_BODY: ApiBodyOptions = {
  schema: {
    type: 'object',
    required: ['categoryId', 'messageText'],
    properties: {
      categoryId: { type: 'integer' },
      messageText: { type: 'string' },
      targetTenantId: {
        type: 'string',
        description:
          'Optional public tenant uuid. Omit for a platform-level ticket.',
      },
      loanId: {
        type: 'string',
        description: 'Optional public loan uuid (Loan.publicId)',
      },
      loanApplicationId: {
        type: 'integer',
        description: 'Optional loan application id owned by the caller',
      },
      file: {
        type: 'string',
        format: 'binary',
        description: 'Optional image attachment (jpeg, png, or webp)',
      },
    },
  },
};

export const CREATE_TICKET_MESSAGE_MULTIPART_BODY: ApiBodyOptions = {
  schema: {
    type: 'object',
    required: ['messageText'],
    properties: {
      messageText: { type: 'string' },
      file: {
        type: 'string',
        format: 'binary',
        description: 'Optional image attachment (jpeg, png, or webp)',
      },
    },
  },
};
