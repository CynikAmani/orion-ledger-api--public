import { HttpException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createHash } from 'crypto';
import { AuthService } from './auth.service';

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

describe('AuthService.refreshSession', () => {
  const findFirst = jest.fn<(args?: unknown) => Promise<unknown>>();
  const update = jest.fn<(args?: unknown) => Promise<unknown>>();
  const signAsync =
    jest.fn<(payload?: unknown, options?: unknown) => Promise<string>>();
  const buildLoginResponse =
    jest.fn<(id: number, tokens?: unknown) => Promise<unknown>>();
  const assertUserAccountIsNotDeleted =
    jest.fn<(userId: string) => Promise<unknown>>();
  const assertUserCanAuthenticate = jest.fn<(id: number) => Promise<void>>();

  const findDemoSession = jest.fn<(args?: unknown) => Promise<unknown>>();
  const updateDemoSession = jest.fn<(args?: unknown) => Promise<unknown>>();
  const deleteDemoSession = jest.fn<(args?: unknown) => Promise<unknown>>();
  const findUserById = jest.fn<(args?: unknown) => Promise<unknown>>();

  const prisma = {
    user: { findFirst, findUnique: findUserById, update },
    demoSession: {
      findUnique: findDemoSession,
      update: updateDemoSession,
      delete: deleteDemoSession,
    },
  };

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    findDemoSession.mockResolvedValue(null);
    signAsync.mockResolvedValue('access-token');
    update.mockResolvedValue({});
    assertUserAccountIsNotDeleted.mockImplementation((userId) =>
      Promise.resolve({ userId }),
    );
    assertUserCanAuthenticate.mockResolvedValue(undefined);
    buildLoginResponse.mockImplementation(() =>
      Promise.resolve({
        accessToken: '',
        refreshToken: '',
        user: {
          userId: 'owner-1',
          onlineRepaymentsEnabled: true,
        },
      }),
    );

    service = new AuthService(
      { signAsync } as never,
      prisma as never,
      {} as never,
      {
        assertUserAccountIsNotDeleted,
        assertUserCanAuthenticate,
      } as never,
      { buildLoginResponse } as never,
      {} as never,
    );
  });

  it('resolves the session from the refresh token hash, not a client-supplied userId', async () => {
    const refreshToken = 'opaque-refresh-token';
    findFirst.mockResolvedValue({
      id: 42,
      userId: 'owner-1',
      sessionState: {
        sessionId: 'session-1',
        refreshToken: hashRefreshToken(refreshToken),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    });

    await expect(service.refreshSession(refreshToken)).resolves.toEqual({
      accessToken: 'access-token',
      refreshToken,
      user: {
        userId: 'owner-1',
        onlineRepaymentsEnabled: true,
      },
    });

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          sessionState: {
            path: ['refreshToken'],
            equals: hashRefreshToken(refreshToken),
          },
        },
      }),
    );
    expect(assertUserAccountIsNotDeleted).toHaveBeenCalledWith('owner-1');
    expect(assertUserCanAuthenticate).toHaveBeenCalledWith(42);
    expect(update).toHaveBeenCalled();
    expect(buildLoginResponse).toHaveBeenCalledWith(42);
  });

  it('does not clear any session when the refresh token is unknown', async () => {
    findFirst.mockResolvedValue(null);

    await expect(
      service.refreshSession('unknown-token'),
    ).rejects.toBeInstanceOf(HttpException);

    expect(update).not.toHaveBeenCalled();
    expect(assertUserAccountIsNotDeleted).not.toHaveBeenCalled();
  });

  it('revokes only the matched session when the token hash is expired', async () => {
    findFirst.mockResolvedValue({
      id: 42,
      userId: 'owner-1',
      sessionState: {
        sessionId: 'session-1',
        refreshToken: hashRefreshToken('expired-token'),
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      },
    });

    await expect(
      service.refreshSession('expired-token'),
    ).rejects.toBeInstanceOf(HttpException);

    expect(update).toHaveBeenCalledWith({
      where: { id: 42 },
      data: { sessionState: expect.anything() },
    });
    expect(assertUserCanAuthenticate).not.toHaveBeenCalled();
  });

  it('refreshes one sandbox visit without extending it or touching other sessions', async () => {
    const refreshToken = 'sandbox-refresh';
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    findDemoSession.mockResolvedValue({
      id: 'session-1',
      userId: 7,
      expiresAt,
    });
    findUserById.mockResolvedValue({ id: 7, userId: 'sandbox-demo' });

    await service.refreshSession(refreshToken);

    expect(updateDemoSession).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { lastActivityAt: expect.any(Date) },
    });
    expect(update).not.toHaveBeenCalled();
    expect(deleteDemoSession).not.toHaveBeenCalled();
    expect(signAsync).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        expiresIn: expect.any(Number),
      }),
    );
  });

  it('revokes only the expired sandbox visit', async () => {
    findDemoSession.mockResolvedValue({
      id: 'session-1',
      userId: 7,
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(
      service.refreshSession('sandbox-refresh'),
    ).rejects.toBeInstanceOf(HttpException);

    expect(deleteDemoSession).toHaveBeenCalledWith({
      where: { id: 'session-1' },
    });
    expect(update).not.toHaveBeenCalled();
  });
});
