import type { ApiBodyOptions } from '@nestjs/swagger';

export const CREATE_ADVERT_MULTIPART_BODY: ApiBodyOptions = {
  schema: {
    type: 'object',
    required: ['title', 'content'],
    properties: {
      title: { type: 'string' },
      content: { type: 'string' },
      placement: {
        type: 'string',
        enum: ['PUBLIC_PORTAL', 'DASHBOARD', 'ALL'],
      },
      status: {
        type: 'string',
        enum: ['DRAFT', 'ACTIVE', 'ARCHIVED', 'EXPIRED'],
      },
      endDate: { type: 'string', format: 'date-time' },
      file: { type: 'string', format: 'binary' },
    },
  },
};

export const UPDATE_ADVERT_MULTIPART_BODY: ApiBodyOptions = {
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      content: { type: 'string' },
      placement: {
        type: 'string',
        enum: ['PUBLIC_PORTAL', 'DASHBOARD', 'ALL'],
      },
      endDate: { type: 'string', format: 'date-time' },
      file: { type: 'string', format: 'binary' },
    },
  },
};
