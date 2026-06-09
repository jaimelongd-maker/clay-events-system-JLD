import { Router, Request, Response } from 'express';
import { EventSchema } from '../schemas/event.schema';
import { getRedisClient } from '../infrastructure/redis';

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

export default router;
