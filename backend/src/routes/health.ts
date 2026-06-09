import { Router, Request, Response } from 'express';
import { isMongoConnected } from '../infrastructure/mongo';
import { isRedisConnected } from '../infrastructure/redis';

const router = Router();

router.get('/health', async (_req: Request, res: Response): Promise<void> => {
  const [mongo, redis] = await Promise.all([
    isMongoConnected(),
    isRedisConnected(),
  ]);

  const healthy = mongo && redis;
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    checks: { mongo, redis },
  });
});

export default router;
