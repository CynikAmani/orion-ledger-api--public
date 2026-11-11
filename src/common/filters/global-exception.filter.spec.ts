import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { HttpStatus, type ArgumentsHost } from '@nestjs/common';
import { APP_ERROR_CODES, appHttpException } from '../exceptions/app-http.exception';
import { GlobalExceptionFilter } from './global-exception.filter';

describe('GlobalExceptionFilter', () => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url: '/api/v1/loans/applications/mine' }),
    }),
  } as unknown as ArgumentsHost;

  let filter: GlobalExceptionFilter;

  beforeEach(() => {
    jest.clearAllMocks();
    status.mockReturnValue({ json });
    filter = new GlobalExceptionFilter();
  });

  it('forwards structured extras such as eligibility on 422 bodies', () => {
    const eligibility = {
      uuid: 'tenant-uuid',
      slug: 'acme',
      tenantCode: 'ACME',
      status: 'NOT_READY',
      isEligible: false,
      missingRequirements: ['INTEREST_RATES'],
    };

    filter.catch(
      appHttpException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'This institution is not set up for loan applications yet',
        APP_ERROR_CODES.TENANT_NOT_READY_FOR_LOAN_APPLICATIONS,
        { eligibility },
      ),
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 422,
        errorCode: APP_ERROR_CODES.TENANT_NOT_READY_FOR_LOAN_APPLICATIONS,
        message: 'This institution is not set up for loan applications yet',
        eligibility,
      }),
    );
  });
});
