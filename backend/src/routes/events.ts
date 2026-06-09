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

  await getRedisClient().lpush('events:queue', JSON.stringify(result.data));
  res.status(202).json({ queued: true });
});

export default router;
