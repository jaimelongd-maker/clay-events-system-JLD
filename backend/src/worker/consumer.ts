import { getDb } from '../infrastructure/mongo';
import { getRedisClient } from '../infrastructure/redis';
import { EventSchema, Event } from '../schemas/event.schema';
import { REDIS_KEYS } from '../constants';

export async function createIndexes(): Promise<void> {
  const col = getDb().collection('events');
  await Promise.all([
    col.createIndex({ eventType: 1 }),
    col.createIndex({ userId: 1 }),
    col.createIndex({ timestamp: -1 }),
  ]);
  console.log('MongoDB indexes ready');
}

export async function processEvent(payload: string): Promise<void> {
  let raw: unknown;
  try {
    raw = JSON.parse(payload);
  } catch {
    console.error('Discarding event: invalid JSON:', payload);
    return;
  }

  const result = EventSchema.safeParse(raw);
  if (!result.success) {
    console.error('Discarding event: schema invalid:', result.error.flatten());
    return;
  }

  await saveWithRetry(result.data);
}

export async function saveWithRetry(event: Event, retries = 3): Promise<void> {
  try {
    await getDb().collection<Event>('events').insertOne(event);
  } catch (err) {
    if (retries === 0) {
      console.error('Failed to persist event after retries, discarding:', event);
      return;
    }
    const attempt = 4 - retries; // 1s → 2s → 3s
    await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    return saveWithRetry(event, retries - 1);
  }
}

// isRunning se inyecta para poder parar el loop desde worker.ts (y testearlo)
export async function consume(isRunning: () => boolean): Promise<void> {
  const redis = getRedisClient();
  console.log(`Worker consuming from ${REDIS_KEYS.EVENTS_QUEUE}`);

  while (isRunning()) {
    try {
      const entry = await redis.brpop(REDIS_KEYS.EVENTS_QUEUE, 5); // bloquea 5s; null = timeout, reintenta
      if (!entry) continue;
      const [, payload] = entry;
      await processEvent(payload);
    } catch (err) {
      console.error('Queue error, retrying in 3s:', (err as Error).message);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
}
