import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, afterEach, describe, expect, it, jest } from '@jest/globals';
import { of, throwError } from 'rxjs';
import { IS_OPTIONAL_AUTH_KEY } from '../decorators/optional-auth.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let metadata: { public?: boolean; optionalAuth?: boolean };
  let guard: JwtAuthGuard;
  let canActivateParent: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    metadata = {};
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => {
        if (key === IS_PUBLIC_KEY) {
          return metadata.public;
        }
        if (key === IS_OPTIONAL_AUTH_KEY) {
          return metadata.optionalAuth;
        }
        return undefined;
      }),
    };
    guard = new JwtAuthGuard(reflector as unknown as Reflector);
    canActivateParent = jest
      .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
      .mockReturnValue(true);
  });

  afterEach(() => {
    canActivateParent.mockRestore();
  });

  function createContext(method = 'GET'): ExecutionContext {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ method }),
      }),
    } as unknown as ExecutionContext;
  }

  it('allows unauthenticated OPTIONS preflight without JWT validation', () => {
    expect(guard.canActivate(createContext('OPTIONS'))).toBe(true);
    expect(canActivateParent).not.toHaveBeenCalled();
  });

  it('skips JWT validation (and therefore DB lookup) on @Public routes', () => {
    metadata.public = true;

    expect(guard.canActivate(createContext())).toBe(true);
    expect(canActivateParent).not.toHaveBeenCalled();
  });

  it('attempts JWT on @OptionalAuth and still allows when auth fails', async () => {
    metadata.public = true;
    metadata.optionalAuth = true;
    canActivateParent.mockReturnValue(throwError(() => new Error('no token')));

    const result = guard.canActivate(createContext());
    await expect(
      new Promise<boolean>((resolve, reject) => {
        if (typeof result === 'object' && result !== null && 'subscribe' in result) {
          result.subscribe({ next: resolve, error: reject });
          return;
        }
        Promise.resolve(result).then(resolve, reject);
      }),
    ).resolves.toBe(true);
    expect(canActivateParent).toHaveBeenCalledTimes(1);
  });

  it('attempts JWT on @OptionalAuth and allows when auth succeeds', async () => {
    metadata.optionalAuth = true;
    canActivateParent.mockReturnValue(of(true));

    const result = guard.canActivate(createContext());
    await expect(
      new Promise<boolean>((resolve, reject) => {
        if (typeof result === 'object' && result !== null && 'subscribe' in result) {
          result.subscribe({ next: resolve, error: reject });
          return;
        }
        Promise.resolve(result).then(resolve, reject);
      }),
    ).resolves.toBe(true);
    expect(canActivateParent).toHaveBeenCalledTimes(1);
  });

  it('delegates to Passport JWT validation on protected routes', () => {
    expect(guard.canActivate(createContext())).toBe(true);
    expect(canActivateParent).toHaveBeenCalledTimes(1);
  });

  it('returns ERR_ACCESS_TOKEN_EXPIRED when Passport reports jwt expired', () => {
    try {
      guard.handleRequest(null, false, { name: 'TokenExpiredError', message: 'jwt expired' }, createContext());
      throw new Error('expected handleRequest to throw');
    } catch (error) {
      expect(error).toMatchObject({
        response: {
          errorCode: 'ERR_ACCESS_TOKEN_EXPIRED',
          message: 'Access token expired',
        },
      });
    }
  });

  it('returns ERR_AUTHENTICATION_REQUIRED when no token is present', () => {
    try {
      guard.handleRequest(null, false, { message: 'No auth token' }, createContext());
      throw new Error('expected handleRequest to throw');
    } catch (error) {
      expect(error).toMatchObject({
        response: {
          errorCode: 'ERR_AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
        },
      });
    }
  });
});
