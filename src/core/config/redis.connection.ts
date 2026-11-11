import { ConfigService } from '@nestjs/config';
import type { ConnectionOptions } from 'bullmq';
import Redis from 'ioredis';
import { CONFIG_KEYS } from './config.keys';
import type { EnvironmentVariables } from './environment-variables.interface';

/**
 * Single shared IORedis client for BullMQ Queues + Workers.
 * Reuse this instance everywhere — Redis Cloud free tier caps at ~30 connections.
 *
 * BullMQ requires maxRetriesPerRequest: null for blocking commands.
 *
 * Note: the app depends on ioredis@6 while bullmq vendors ioredis@5; we cast the
 * shared client to BullMQ's ConnectionOptions so Nest can accept the instance.
 *
 * TLS is opt-in via REDIS_TLS=true. Redis Cloud free-tier public endpoints often
 * speak plain Redis on the given port; forcing TLS causes connect hangs and
 * blocks email enqueue (password-reset / transactional mail).
 */
let sharedRedisConnection: Redis | undefined;

export function getSharedRedisConnection(
  config: ConfigService<EnvironmentVariables, true>,
): ConnectionOptions {
  if (sharedRedisConnection) {
    return sharedRedisConnection as unknown as ConnectionOptions;
  }

  const host = config.getOrThrow(CONFIG_KEYS.REDIS_HOST, { infer: true });
  const port = config.getOrThrow(CONFIG_KEYS.REDIS_PORT, { infer: true });
  const password = config.getOrThrow(CONFIG_KEYS.REDIS_PASSWORD, {
    infer: true,
  });
  const username =
    config.get(CONFIG_KEYS.REDIS_USERNAME, { infer: true }) ?? 'default';
  const useTls = config.get(CONFIG_KEYS.REDIS_TLS, { infer: true }) ?? false;

  sharedRedisConnection = new Redis({
    host,
    port,
    username,
    password,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    ...(useTls ? { tls: {} } : {}),
  });

  return sharedRedisConnection as unknown as ConnectionOptions;
}
