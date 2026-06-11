import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { getDb } from '../infrastructure/mongo';

const router = Router();
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const TOP_USERS_LIMIT = 3;

const metricsReadLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones, intenta de nuevo más tarde' },
});

// ── GET /metrics ──────────────────────────────────────────────────────────────

router.get('/metrics', metricsReadLimiter, async (_req: Request, res: Response): Promise<void> => {
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
        { $limit: TOP_USERS_LIMIT },
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

// ── GET /metrics/timeline ─────────────────────────────────────────────────────

const TimelineQuerySchema = z.object({
  range: z.enum(['24h', '7d', '30d']).default('24h'),
});

const RANGE_MS: Record<'24h' | '7d' | '30d', number> = {
  '24h': MS_PER_DAY,
  '7d':  7  * MS_PER_DAY,
  '30d': 30 * MS_PER_DAY,
};

router.get('/metrics/timeline', metricsReadLimiter, async (req: Request, res: Response): Promise<void> => {
  const result = TimelineQuerySchema.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({ errors: result.error.flatten() });
    return;
  }

  try {
    const { range } = result.data;
    const col = getDb().collection('events');
    const cutoff = Date.now() - RANGE_MS[range];

    if (range === '24h') {
      const raw = await col.aggregate<{ _id: number; count: number }>([
        { $match: { timestamp: { $gte: cutoff } } },
        { $group: { _id: { $hour: { $toDate: '$timestamp' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]).toArray();

      const data = raw.map(({ _id, count }) => ({
        timeLabel: `${String(_id).padStart(2, '0')}:00`,
        count,
      }));
      res.status(200).json({ data, range });
    } else {
      const raw = await col.aggregate<{ _id: string; count: number }>([
        { $match: { timestamp: { $gte: cutoff } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: { $toDate: '$timestamp' } } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]).toArray();

      const data = raw.map(({ _id, count }) => {
        const [, month, day] = _id.split('-');
        return { timeLabel: `${day}/${month}`, count };
      });
      res.status(200).json({ data, range });
    }
  } catch (err) {
    console.error('Failed to fetch timeline:', (err as Error).message);
    res.status(500).json({ error: 'Failed to fetch timeline' });
  }
});

// ── GET /metrics/users-activity ───────────────────────────────────────────────

const UsersActivityQuerySchema = z.object({
  range: z.enum(['24h', '7d']).default('24h'),
});

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

router.get('/metrics/users-activity', metricsReadLimiter, async (req: Request, res: Response): Promise<void> => {
  const result = UsersActivityQuerySchema.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({ errors: result.error.flatten() });
    return;
  }

  try {
    const { range } = result.data;
    const col = getDb().collection('events');
    const cutoff = Date.now() - (range === '24h' ? MS_PER_DAY : 7 * MS_PER_DAY);

    if (range === '24h') {
      type HourBucket = { hour: number; count: number };
      type UserDoc = { _id: string; total: number; hours: HourBucket[] };

      const raw = await col.aggregate<UserDoc>([
        { $match: { timestamp: { $gte: cutoff } } },
        { $group: { _id: { userId: '$userId', hour: { $hour: { $toDate: '$timestamp' } } }, count: { $sum: 1 } } },
        { $group: { _id: '$_id.userId', total: { $sum: '$count' }, hours: { $push: { hour: '$_id.hour', count: '$count' } } } },
        { $sort: { total: -1 } },
        { $limit: 5 },
      ]).toArray();

      const data = raw.map(user => {
        const countByHour: Record<number, number> = {};
        user.hours.forEach(h => { countByHour[h.hour] = h.count; });
        const hours = Array.from({ length: 24 }, (_, i) => ({
          timeLabel: `${String(i).padStart(2, '0')}:00`,
          count: countByHour[i] ?? 0,
        }));
        return { userId: user._id, hours };
      });
      res.status(200).json({ data, range });
    } else {
      type DayBucket = { dayOfWeek: number; count: number };
      type UserDoc = { _id: string; total: number; days: DayBucket[] };

      const raw = await col.aggregate<UserDoc>([
        { $match: { timestamp: { $gte: cutoff } } },
        { $group: { _id: { userId: '$userId', dayOfWeek: { $dayOfWeek: { $toDate: '$timestamp' } } }, count: { $sum: 1 } } },
        { $group: { _id: '$_id.userId', total: { $sum: '$count' }, days: { $push: { dayOfWeek: '$_id.dayOfWeek', count: '$count' } } } },
        { $sort: { total: -1 } },
        { $limit: 5 },
      ]).toArray();

      const data = raw.map(user => {
        const countByDay: Record<number, number> = {};
        user.days.forEach(d => { countByDay[d.dayOfWeek] = d.count; });
        const hours = DAY_LABELS.map((label, i) => ({
          timeLabel: label,
          count: countByDay[i + 1] ?? 0,
        }));
        return { userId: user._id, hours };
      });
      res.status(200).json({ data, range });
    }
  } catch (err) {
    console.error('Failed to fetch users activity:', (err as Error).message);
    res.status(500).json({ error: 'Failed to fetch users activity' });
  }
});

// ── GET /metrics/users-distribution ──────────────────────────────────────────

router.get('/metrics/users-distribution', metricsReadLimiter, async (_req: Request, res: Response): Promise<void> => {
  try {
    const col = getDb().collection('events');

    type TypeBucket = { type: string; count: number };
    type UserDoc = { _id: string; total: number; types: TypeBucket[] };

    const raw = await col.aggregate<UserDoc>([
      { $group: { _id: { userId: '$userId', eventType: '$eventType' }, count: { $sum: 1 } } },
      { $group: { _id: '$_id.userId', total: { $sum: '$count' }, types: { $push: { type: '$_id.eventType', count: '$count' } } } },
      { $sort: { total: -1 } },
      { $limit: 3 },
    ]).toArray();

    const data = raw.map(user => ({
      userId: user._id,
      types: user.types.sort((a, b) => a.type.localeCompare(b.type)),
    }));

    res.status(200).json({ data });
  } catch (err) {
    console.error('Failed to fetch users distribution:', (err as Error).message);
    res.status(500).json({ error: 'Failed to fetch users distribution' });
  }
});

export default router;
