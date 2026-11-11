import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { AdvertStatus } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';
import { UpdateAdvertDto } from '../../../content-management/adverts/dto/update-advert.dto';
import { CreateSupportTicketDto } from '../../../support/tickets/dto/create-support-ticket.dto';
import { OnboardTenantDto } from '../../../tenants/platform/dto/onboard-tenant.dto';
import { UpdateManagedUserDto } from '../../../users/managed-user/shared/dto/update-managed-user.dto';
import { UpdateProfileDto } from '../../../users/me/dto/update-profile.dto';
import { RefreshSessionDto } from '../../auth/dto/refresh-session.dto';

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

async function expectForbiddenFieldRejected(
  metatype: new () => object,
  payload: Record<string, unknown>,
): Promise<void> {
  await expect(
    pipe.transform(payload, {
      type: 'body',
      metatype,
      data: '',
    }),
  ).rejects.toBeInstanceOf(BadRequestException);
}

describe('DTO state-mutation guardrails', () => {
  it('rejects status on general advert updates (use PATCH :id/status)', async () => {
    await expectForbiddenFieldRejected(UpdateAdvertDto, {
      title: 'Updated',
      status: AdvertStatus.ACTIVE,
    });
  });

  it('rejects isBlocked / rolePublicIds on managed-user profile updates', async () => {
    await expectForbiddenFieldRejected(UpdateManagedUserDto, {
      fullname: 'Updated',
      isBlocked: true,
    });

    await expectForbiddenFieldRejected(UpdateManagedUserDto, {
      fullname: 'Updated',
      rolePublicIds: ['role-public-id'],
    });
  });

  it('rejects financial/status fields on self-service profile updates', async () => {
    await expectForbiddenFieldRejected(UpdateProfileDto, {
      fullname: 'Updated',
      status: 'APPROVED',
    });

    await expectForbiddenFieldRejected(UpdateProfileDto, {
      fullname: 'Updated',
      isCleared: true,
    });

    await expectForbiddenFieldRejected(UpdateProfileDto, {
      fullname: 'Updated',
      isBlocked: true,
    });
  });

  it('rejects status injection on customer ticket creation', async () => {
    await expectForbiddenFieldRejected(CreateSupportTicketDto, {
      categoryId: 1,
      messageText: 'Help please',
      status: 'RESOLVED',
    });
  });

  it('rejects role inputs on tenant onboarding (roles are seeded internally)', async () => {
    const basePayload = {
      name: 'Acme Finance',
      slug: 'acme-finance',
      tenantCode: 'ACME01',
      representative: {
        email: 'jane.doe@acme-finance.com',
        firstName: 'Jane',
        lastName: 'Doe',
        userId: 'jane.doe',
        nationalId: 'NAT-123-456-789',
      },
    };

    await expectForbiddenFieldRejected(OnboardTenantDto, {
      ...basePayload,
      representative: {
        ...basePayload.representative,
        rolePublicIds: ['role-public-id'],
      },
    });

    await expectForbiddenFieldRejected(OnboardTenantDto, {
      ...basePayload,
      representative: {
        ...basePayload.representative,
        roles: ['Administrator'],
      },
    });
  });

  it('rejects userId on refresh (session is bound to the refresh token)', async () => {
    await expectForbiddenFieldRejected(RefreshSessionDto, {
      userId: 'someone-else',
      refreshToken: 'opaque-refresh-token',
    });
  });

  it('accepts allowlisted profile fields', async () => {
    await expect(
      pipe.transform(
        { fullname: 'Valid Name' },
        {
          type: 'body',
          metatype: UpdateProfileDto,
          data: '',
        },
      ),
    ).resolves.toEqual({ fullname: 'Valid Name' });
  });
});
