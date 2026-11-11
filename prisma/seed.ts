import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { buildPgPoolConfig } from '../src/core/database/build-pg-pool-config.util';
import {
  GENDERS,
  MALAWI_DISTRICTS,
} from './data/system-initial-data/reference-data';
import {
  ALL_PERMISSIONS_ARRAY,
  PERMISSIONS,
} from '../src/modules/auth/shared/constants/permissions.constant';
import { hashPassword } from '../src/modules/auth/shared/utils/hash-password.util';
import {
  SYSTEM_ROLES,
  SYSTEM_ROOT_USER_EMAIL,
  SYSTEM_ROOT_USER_ID,
} from '../src/modules/auth/shared/constants/roles.constant';
import { GLOBAL_INBOX_PERMISSIONS } from '../src/modules/roles/shared/utils/role-permission-scope.util';
import { DEFAULT_PLATFORM_NOTIFICATION_CONFIGS } from '../src/core/notifications/constants/notification-action-keys.constant';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set in .env');
}

// Same SSL-aware pool as Nest runtime. Seed uses DATABASE_URL (ol_app);
// `prisma db push` uses DIRECT_URL via prisma.config.ts — different path.
const pool = new Pool(buildPgPoolConfig(databaseUrl));
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const CUSTOMER_PERMISSIONS = [
  PERMISSIONS.SELF.VIEW,
  PERMISSIONS.SELF.READ,
  PERMISSIONS.SELF.UPDATE,
  PERMISSIONS.SELF.DELETE,
  ...GLOBAL_INBOX_PERMISSIONS,
  PERMISSIONS.LOAN_APPLICATIONS.CREATE,
  PERMISSIONS.LOAN_APPLICATIONS.SELF_READ,
  PERMISSIONS.LOAN_APPLICATIONS.SELF_UPDATE,
  PERMISSIONS.LOAN_APPLICATIONS.SELF_DELETE,
  PERMISSIONS.LOANS.SELF_READ,
  PERMISSIONS.REPAYMENTS.SELF_READ,
  PERMISSIONS.REPAYMENT_DETAILS.CUSTOMER_READ,
  PERMISSIONS.CUSTOMER_DASHBOARD.VIEW,
  PERMISSIONS.CUSTOMER_DASHBOARD.SELF_READ,
  PERMISSIONS.CUSTOMER_DASHBOARD.ACTION_QUEUE,
  PERMISSIONS.CUSTOMER_DASHBOARD.OWNED_PORTFOLIO,
  PERMISSIONS.CUSTOMER_DASHBOARD.LIFETIME_ACTIVITY,
  PERMISSIONS.CUSTOMER_DASHBOARD.USABLE_OFFERS,
  PERMISSIONS.CUSTOMER_DASHBOARD.PRODUCT_CATALOG,
  PERMISSIONS.LOAN_CONFIGURATIONS.APPLICATION_SETTINGS_AMOUNT_LIMITS_READ,
  PERMISSIONS.LOAN_CONFIGURATIONS.INTEREST_RATES_CUSTOMER_READ,
  PERMISSIONS.SPECIAL_OFFERS.VIEW,
  PERMISSIONS.SPECIAL_OFFERS.SELF_READ,
  PERMISSIONS.SPECIAL_OFFERS.SELF_REDEEM,
  PERMISSIONS.SPECIAL_OFFERS.SELF_DISMISS,
  PERMISSIONS.CUSTOMER_FAVORITES.VIEW,
  PERMISSIONS.CUSTOMER_FAVORITES.READ,
  PERMISSIONS.CUSTOMER_FAVORITES.MARK,
  PERMISSIONS.CUSTOMER_FAVORITES.UNMARK,
  PERMISSIONS.BRAND_REQUESTS.CREATE,
  PERMISSIONS.BRAND_REQUESTS.SELF_READ,
  PERMISSIONS.BRAND_REQUESTS.SELF_UPDATE,
  PERMISSIONS.BRAND_REQUESTS.SELF_CANCEL,
  PERMISSIONS.SUPPORT.CUSTOMER_VIEW,
  PERMISSIONS.SUPPORT.CUSTOMER_CREATE,
  PERMISSIONS.SUPPORT.CUSTOMER_READ,
  PERMISSIONS.SUPPORT.CUSTOMER_REPLY,
];

async function grantNamedPermissions(
  roleId: number,
  names: readonly string[],
): Promise<void> {
  const permissions = await prisma.permission.findMany({
    where: { name: { in: [...names] } },
    select: { permissionId: true },
  });

  if (permissions.length === 0) {
    return;
  }

  await prisma.rolePermission.createMany({
    data: permissions.map((permission) => ({
      roleId,
      permissionId: permission.permissionId,
    })),
    skipDuplicates: true,
  });
}

async function ensurePlatformRole(role: {
  key: string;
  name: string;
  description: string;
}): Promise<{ roleId: number }> {
  const existing = await prisma.role.findFirst({
    where: { tenantId: null, key: role.key },
    select: { roleId: true },
  });

  if (existing) {
    return existing;
  }

  return prisma.role.create({
    data: {
      key: role.key,
      name: role.name,
      description: role.description,
      tenantId: null,
    },
    select: { roleId: true },
  });
}

async function main() {
  const genderCount = await prisma.gender.count();
  if (genderCount === 0) {
    await prisma.gender.createMany({
      data: GENDERS.map((gender) => ({ gender })),
    });
  }

  const districtCount = await prisma.district.count();
  if (districtCount === 0) {
    await prisma.district.createMany({
      data: MALAWI_DISTRICTS.map((districtName) => ({ districtName })),
    });
  }

  const existingPlatformNotificationKeys = new Set(
    (
      await prisma.notificationConfig.findMany({
        where: { tenantId: null },
        select: { actionKey: true },
      })
    ).map((row) => row.actionKey),
  );
  const missingPlatformNotificationConfigs =
    DEFAULT_PLATFORM_NOTIFICATION_CONFIGS.filter(
      (config) => !existingPlatformNotificationKeys.has(config.actionKey),
    );
  if (missingPlatformNotificationConfigs.length > 0) {
    await prisma.notificationConfig.createMany({
      data: missingPlatformNotificationConfigs.map((config) => ({
        tenantId: null,
        actionKey: config.actionKey,
        description: config.description,
      })),
    });
  }
  await prisma.permission.createMany({
    data: ALL_PERMISSIONS_ARRAY.map((name) => ({
      name,
      description: `Allows atomic action: ${name.replaceAll(':', ' ')}`,
    })),
    skipDuplicates: true,
  });

  const adminRole = await ensurePlatformRole(SYSTEM_ROLES.SUPER_ADMIN);
  const customerRole = await ensurePlatformRole(SYSTEM_ROLES.CUSTOMER);

  const allPermissions = await prisma.permission.findMany({
    select: { permissionId: true },
  });
  await prisma.rolePermission.createMany({
    data: allPermissions.map((permission) => ({
      roleId: adminRole.roleId,
      permissionId: permission.permissionId,
    })),
    skipDuplicates: true,
  });
  await grantNamedPermissions(customerRole.roleId, CUSTOMER_PERMISSIONS);

  const existingRoot = await prisma.user.findUnique({
    where: { userId: SYSTEM_ROOT_USER_ID },
    select: { id: true },
  });

  if (!existingRoot) {
    const password = await hashPassword(
      process.env.INITIAL_ADMIN_PASSWORD || '!2026xandixo',
    );
    await prisma.user.create({
      data: {
        userId: SYSTEM_ROOT_USER_ID,
        password,
        fullname: 'System Master Administrator',
        nationalId: 'NAT-999-000-111',
        email: SYSTEM_ROOT_USER_EMAIL,
        phone: '+10000000000',
        userRoles: {
          create: {
            roleId: adminRole.roleId,
            tenantId: null,
          },
        },
      },
    });
  } else {
    await prisma.userRole.createMany({
      data: [
        {
          userId: existingRoot.id,
          roleId: adminRole.roleId,
          tenantId: null,
        },
      ],
      skipDuplicates: true,
    });
  }

  console.log('Seed complete.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
