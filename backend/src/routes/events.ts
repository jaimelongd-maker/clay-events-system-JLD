import { Router, Request, Response } from 'express';
import { Filter } from 'mongodb';
import { EventSchema, EventQuerySchema, Event } from '../schemas/event.schema';
import { getRedisClient } from '../infrastructure/redis';
import { getDb } from '../infrastructure/mongo';

const router = Router();

router.post('/events', async (req: Request, res: Response): Promise<void> => {
  const result = EventSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({ errors: result.error.flatten() });
    return;
  }

  try {
    await getRedisClient().lpush('events:queue', JSON.stringify(result.data));
    res.status(202).json({ queued: true });
  } catch (err) {
    console.error('Failed to enqueue event:', (err as Error).message);
    res.status(500).json({ error: 'Failed to enqueue event' });
  }
});

router.get('/events', async (req: Request, res: Response): Promise<void> => {
  const result = EventQuerySchema.safeParse(req.query);

  if (!result.success) {
    res.status(400).json({ errors: result.error.flatten() });
    return;
  }

  try {
    const { eventType, userId, fromTimestamp, toTimestamp } = result.data;
    const filter: Filter<Event> = {};

    if (eventType) filter.eventType = eventType;
    if (userId) filter.userId = userId;
    if (fromTimestamp !== undefined || toTimestamp !== undefined) {
      filter.timestamp = {
        ...(fromTimestamp !== undefined && { $gte: fromTimestamp }),
        ...(toTimestamp !== undefined && { $lte: toTimestamp }),
      };
    }

    const events = await getDb()
      .collection<Event>('events')
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(20)
      .toArray();

    res.status(200).json({ events });
  } catch (err) {
    console.error('Failed to query events:', (err as Error).message);
    res.status(500).json({ error: 'Failed to query events' });
  }
});

export default router;
