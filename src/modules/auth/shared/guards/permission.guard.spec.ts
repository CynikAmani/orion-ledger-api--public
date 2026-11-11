import {
  ExecutionContext,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PERMISSIONS } from '../constants/permissions.constant';
import { CUSTOMER_ROLE_KEY } from '../constants/roles.constant';
import { IS_AUTHENTICATED_KEY } from '../decorators/authenticated.decorator';
import { PERMISSION_METADATA_KEY } from '../decorators/permission.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PermissionGuard } from './permission.guard';

const CUSTOMER_SELF_SERVICE_PERMISSIONS = [
  PERMISSIONS.SELF.VIEW,
  PERMISSIONS.SELF.READ,
  PERMISSIONS.SELF.UPDATE,
  PERMISSIONS.SELF.DELETE,
];

describe('PermissionGuard', () => {
  let guard: PermissionGuard;
  let metadata: {
    public?: boolean;
    permission?: string;
    authenticated?: boolean;
  };

  beforeEach(() => {
    metadata = {};
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => {
        if (key === IS_PUBLIC_KEY) {
          return metadata.public;
        }
        if (key === PERMISSION_METADATA_KEY) {
          return metadata.permission;
        }
        if (key === IS_AUTHENTICATED_KEY) {
          return metadata.authenticated;
        }
        return undefined;
      }),
    };
    guard = new PermissionGuard(reflector as unknown as Reflector);
  });

  function createContext(
    user?: {
      userId?: string;
      roles?: string[];
      permissions?: string[];
    },
    method = 'GET',
  ): ExecutionContext {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user, method }),
      }),
    } as unknown as ExecutionContext;
  }

  it('allows unauthenticated OPTIONS preflight without permission checks', () => {
    expect(guard.canActivate(createContext(undefined, 'OPTIONS'))).toBe(true);
  });

  it('allows @Public routes without authentication', () => {
    metadata.public = true;
    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('allows @Authenticated routes for any valid JWT user', () => {
    metadata.authenticated = true;
    expect(
      guard.canActivate(
        createContext({
          userId: 'customer-1',
          roles: [CUSTOMER_ROLE_KEY],
          permissions: CUSTOMER_SELF_SERVICE_PERMISSIONS,
        }),
      ),
    ).toBe(true);
  });

  it('rejects @Authenticated routes without a user', () => {
    metadata.authenticated = true;
    expect(() => guard.canActivate(createContext())).toThrow(HttpException);
  });

  it('denies routes missing @Public, @Authenticated, and @Permission (fail-closed)', () => {
    expect(() =>
      guard.canActivate(
        createContext({
          userId: 'customer-1',
          roles: [CUSTOMER_ROLE_KEY],
          permissions: CUSTOMER_SELF_SERVICE_PERMISSIONS,
        }),
      ),
    ).toThrow(ForbiddenException);

    try {
      guard.canActivate(
        createContext({
          userId: 'customer-1',
          roles: [CUSTOMER_ROLE_KEY],
          permissions: CUSTOMER_SELF_SERVICE_PERMISSIONS,
        }),
      );
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).message).toBe(
        'Route missing permission declaration',
      );
    }
  });

  it('returns 403 when CUSTOMER self-service permissions hit /admin/user (platform:users:read)', () => {
    metadata.permission = PERMISSIONS.PLATFORM.USERS_READ;

    expect(() =>
      guard.canActivate(
        createContext({
          userId: 'customer-1',
          roles: [CUSTOMER_ROLE_KEY],
          permissions: CUSTOMER_SELF_SERVICE_PERMISSIONS,
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('returns 403 when CUSTOMER lacks tenant:roles:assign', () => {
    metadata.permission = PERMISSIONS.TENANT.ROLES_ASSIGN;

    expect(() =>
      guard.canActivate(
        createContext({
          userId: 'customer-1',
          roles: [CUSTOMER_ROLE_KEY],
          permissions: CUSTOMER_SELF_SERVICE_PERMISSIONS,
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('allows CUSTOMER self-service permissions on /me (self:read)', () => {
    metadata.permission = PERMISSIONS.SELF.READ;

    expect(
      guard.canActivate(
        createContext({
          userId: 'customer-1',
          roles: [CUSTOMER_ROLE_KEY],
          permissions: CUSTOMER_SELF_SERVICE_PERMISSIONS,
        }),
      ),
    ).toBe(true);
  });

  it('allows any user, including Super Admin, when the live permission list includes the requirement', () => {
    metadata.permission = PERMISSIONS.PLATFORM.USERS_READ;

    expect(
      guard.canActivate(
        createContext({
          userId: 'root-admin',
          roles: ['SUPER_ADMIN'],
          permissions: [PERMISSIONS.PLATFORM.USERS_READ],
        }),
      ),
    ).toBe(true);
  });

  it('denies Super Admin when the required permission is absent from the live list', () => {
    metadata.permission = PERMISSIONS.PLATFORM.USERS_READ;

    expect(() =>
      guard.canActivate(
        createContext({
          userId: 'root-admin',
          roles: ['SUPER_ADMIN'],
          permissions: [],
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('rejects unauthenticated requests when a permission is required', () => {
    metadata.permission = PERMISSIONS.PLATFORM.USERS_READ;

    expect(() => guard.canActivate(createContext())).toThrow(HttpException);
  });
});
