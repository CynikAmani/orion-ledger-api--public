import type { ApiBodyOptions } from '@nestjs/swagger';

export const CREATE_BRAND_SHOWCASE_MULTIPART_BODY: ApiBodyOptions = {
  schema: {
    type: 'object',
    required: ['title', 'category'],
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      category: {
        type: 'string',
        enum: ['OFFICE_BRANCH', 'TEAM_MEMBER', 'ACHIEVEMENT', 'EVENT'],
      },
      isPublished: { type: 'boolean' },
      file: { type: 'string', format: 'binary' },
    },
  },
};

export const UPDATE_BRAND_SHOWCASE_MULTIPART_BODY: ApiBodyOptions = {
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      category: {
        type: 'string',
        enum: ['OFFICE_BRANCH', 'TEAM_MEMBER', 'ACHIEVEMENT', 'EVENT'],
      },
      isPublished: { type: 'boolean' },
      file: { type: 'string', format: 'binary' },
    },
  },
};
