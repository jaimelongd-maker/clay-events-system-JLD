import { Router, Request, Response } from 'express';
import { getDb } from '../infrastructure/mongo';

const router = Router();

router.get('/metrics', async (_req: Request, res: Response): Promise<void> => {
  try {
    const col = getDb().collection('events');

    const [totalEvents, byTypeRaw, topUsers] = await Promise.all([
      col.countDocuments(),

      col.aggregate<{ _id: string; count: number }>([
        { $group: { _id: '$eventType', count: { $sum: 1 } } },
      ]).toArray(),

      col.aggregate<{ userId: string; count: number }>([
        { $group: { _id: '$userId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 3 },
        { $project: { _id: 0, userId: '$_id', count: 1 } },
      ]).toArray(),
    ]);

    const eventsByType = Object.fromEntries(
      byTypeRaw.map(({ _id, count }) => [_id, count])
    );

    res.status(200).json({ totalEvents, eventsByType, topUsers });
  } catch (err) {
    console.error('Failed to fetch metrics:', (err as Error).message);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

export default router;
