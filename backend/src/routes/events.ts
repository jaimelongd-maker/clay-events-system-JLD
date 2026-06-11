import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { Filter, WithId } from 'mongodb';
import { EventSchema, EventQuerySchema, Event } from '../schemas/event.schema';
import { getRedisClient } from '../infrastructure/redis';
import { getDb } from '../infrastructure/mongo';
import { REDIS_KEYS } from '../constants';

const router = Router();

const DEFAULT_EVENT_LIMIT = 20;
const MAX_EVENT_LIMIT = 1000;

const rateLimitMessage = { error: 'Demasiadas peticiones, intenta de nuevo más tarde' };

const postEventsLimiter   = rateLimit({ windowMs: 60_000, limit: 60,  standardHeaders: 'draft-7', legacyHeaders: false, message: rateLimitMessage });
const deleteEventsLimiter = rateLimit({ windowMs: 60_000, limit: 5,   standardHeaders: 'draft-7', legacyHeaders: false, message: rateLimitMessage });
const getEventsLimiter    = rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false, message: rateLimitMessage });

router.post('/events', postEventsLimiter, async (req: Request, res: Response): Promise<void> => {
  const result = EventSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({ errors: result.error.flatten() });
    return;
  }

  try {
    await getRedisClient().lpush(REDIS_KEYS.EVENTS_QUEUE, JSON.stringify(result.data));
    res.status(202).json({ queued: true });
  } catch (err) {
    console.error('Failed to enqueue event:', (err as Error).message);
    res.status(500).json({ error: 'Failed to enqueue event' });
  }
});

router.get('/events', getEventsLimiter, async (req: Request, res: Response): Promise<void> => {
  const result = EventQuerySchema.safeParse(req.query);

  if (!result.success) {
    res.status(400).json({ errors: result.error.flatten() });
    return;
  }

  try {
    const { eventType, userId, fromTimestamp, toTimestamp, limit: rawLimit } = result.data;
    const limit = Math.min(rawLimit ?? DEFAULT_EVENT_LIMIT, MAX_EVENT_LIMIT);
    const filter: Filter<Event> = {};

    if (eventType) filter.eventType = eventType;
    if (userId) filter.userId = userId;
    if (fromTimestamp !== undefined || toTimestamp !== undefined) {
      filter.timestamp = {
        ...(fromTimestamp !== undefined && { $gte: fromTimestamp }),
        ...(toTimestamp !== undefined && { $lte: toTimestamp }),
      };
    }

    const events: WithId<Event>[] = await getDb()
      .collection<Event>('events')
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();

    res.status(200).json({ events });
  } catch (err) {
    console.error('Failed to query events:', (err as Error).message);
    res.status(500).json({ error: 'Failed to query events' });
  }
});

router.delete('/events', deleteEventsLimiter, async (_req: Request, res: Response): Promise<void> => {
  try {
    await Promise.all([
      getDb().collection('events').deleteMany({}),
      getRedisClient().del(REDIS_KEYS.EVENTS_QUEUE),
    ]);
    res.status(200).json({ deleted: true });
  } catch (err) {
    console.error('Failed to clear events:', (err as Error).message);
    res.status(500).json({ error: 'Failed to clear events' });
  }
});

export default router;
