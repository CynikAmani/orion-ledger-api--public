import type { PrismaClient } from '@prisma/client';
import { SYSTEM_ROLES } from '../constants/roles.constant';

type RoleDelegate = Pick<PrismaClient, 'role'>;

export type PlatformRoleRef = {
  key: string;
  name: string;
  description: string;
};

export async function findOrCreatePlatformRole(
  prisma: RoleDelegate,
  definition: PlatformRoleRef,
): Promise<{ roleId: number; publicId: string }> {
  const existing = await prisma.role.findFirst({
    where: { key: definition.key, tenantId: null },
    select: { roleId: true, publicId: true },
  });

  if (existing) {
    return existing;
  }

  return prisma.role.create({
    data: {
      key: definition.key,
      name: definition.name,
      description: definition.description,
      tenantId: null,
    },
    select: { roleId: true, publicId: true },
  });
}

export function findOrCreatePlatformCustomerRole(
  prisma: RoleDelegate,
): Promise<{ roleId: number; publicId: string }> {
  return findOrCreatePlatformRole(prisma, SYSTEM_ROLES.CUSTOMER);
}
