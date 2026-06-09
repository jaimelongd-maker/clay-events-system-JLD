import Redis from 'ioredis';
import { config } from '../config';

let client: Redis | null = null;

export function getRedisClient(): Redis {
  if (!client) {
    client = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      maxRetriesPerRequest: 3,
      // Exponential backoff hasta 3s, abandona tras 10 intentos
      retryStrategy: (times: number) => (times > 10 ? null : Math.min(times * 500, 3000)),
    });

    client.on('connect', () => console.log('Redis connected'));
    client.on('error', (err: Error) => console.error('Redis error:', err.message));
  }
  return client;
}

export async function isRedisConnected(): Promise<boolean> {
  try {
    const pong = await getRedisClient().ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}
