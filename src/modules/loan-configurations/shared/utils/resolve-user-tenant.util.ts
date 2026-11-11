import { ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../../../../core/database/prisma.service';

/**
 * Resolves the tenant membership for a user record (User.tenantId).
 * Used by loan flows that operate on behalf of a customer/applicant.
 */
export async function resolveUserTenantId(
  prisma: PrismaService,
  userId: number,
): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tenantId: true },
  });

  if (!user?.tenantId) {
    throw new ForbiddenException('A tenant membership is required');
  }

  return user.tenantId;
}
