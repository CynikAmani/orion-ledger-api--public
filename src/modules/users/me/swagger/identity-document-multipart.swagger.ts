import type { ApiBodyOptions } from '@nestjs/swagger';

export const UPSERT_MY_IDENTITY_DOCUMENT_MULTIPART_BODY: ApiBodyOptions = {
  schema: {
    type: 'object',
    properties: {
      identityDocument: {
        type: 'string',
        format: 'binary',
        description:
          'Identity document scan — National ID, passport, or driver\'s licence (jpeg/png/webp/gif, max 5MB). Omit to leave unchanged.',
      },
      signature: {
        type: 'string',
        format: 'binary',
        description:
          'Signature image (jpeg/png/webp/gif, max 5MB). Omit to leave unchanged.',
      },
    },
  },
};
