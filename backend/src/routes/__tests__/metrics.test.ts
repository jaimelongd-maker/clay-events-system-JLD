import express from 'express';
import request from 'supertest';

const countDocumentsMock = jest.fn();
const aggregateMock = jest.fn();

jest.mock('../../infrastructure/mongo', () => ({
  getDb: () => ({
    collection: () => ({
      countDocuments: countDocumentsMock,
      aggregate: aggregateMock,
    }),
  }),
}));

import metricsRouter from '../metrics';

const app = express();
app.use(metricsRouter);

const byTypeFixture = [
  { _id: 'click', count: 80 },
  { _id: 'pageview', count: 70 },
];
const topUsersFixture = [
  { userId: 'user-1', count: 50 },
  { userId: 'user-2', count: 30 },
  { userId: 'user-3', count: 20 },
];

beforeEach(() => {
  countDocumentsMock.mockResolvedValue(150);
  aggregateMock
    .mockReturnValueOnce({ toArray: () => Promise.resolve(byTypeFixture) })  // eventsByType
    .mockReturnValueOnce({ toArray: () => Promise.resolve(topUsersFixture) }); // topUsers
});
afterEach(() => jest.clearAllMocks());

describe('GET /metrics', () => {
  it('returns 200 with totalEvents', async () => {
    const res = await request(app).get('/metrics');

    expect(res.status).toBe(200);
    expect(res.body.totalEvents).toBe(150);
  });

  it('returns eventsByType as a key-value object', async () => {
    const res = await request(app).get('/metrics');

    expect(res.body.eventsByType).toEqual({ click: 80, pageview: 70 });
  });

  it('returns top 3 users sorted by count descending', async () => {
    const res = await request(app).get('/metrics');

    expect(res.body.topUsers).toEqual([
      { userId: 'user-1', count: 50 },
      { userId: 'user-2', count: 30 },
      { userId: 'user-3', count: 20 },
    ]);
  });

  it('runs the three queries in parallel (Promise.all)', async () => {
    await request(app).get('/metrics');

    // countDocuments + 2 aggregate calls deben haberse ejecutado todos
    expect(countDocumentsMock).toHaveBeenCalledTimes(1);
    expect(aggregateMock).toHaveBeenCalledTimes(2);
  });

  it('passes correct pipeline for topUsers', async () => {
    await request(app).get('/metrics');

    const topUsersPipeline = aggregateMock.mock.calls[1][0];
    expect(topUsersPipeline).toEqual([
      { $group: { _id: '$userId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 3 },
      { $project: { _id: 0, userId: '$_id', count: 1 } },
    ]);
  });

  it('returns empty aggregations when there are no events', async () => {
    countDocumentsMock.mockReset();
    aggregateMock.mockReset();
    countDocumentsMock.mockResolvedValue(0);
    aggregateMock
      .mockReturnValueOnce({ toArray: () => Promise.resolve([]) })
      .mockReturnValueOnce({ toArray: () => Promise.resolve([]) });

    const res = await request(app).get('/metrics');

    expect(res.status).toBe(200);
    expect(res.body.totalEvents).toBe(0);
    expect(res.body.eventsByType).toEqual({});
    expect(res.body.topUsers).toEqual([]);
  });

  it('returns only 2 topUsers when fewer than 3 users exist', async () => {
    countDocumentsMock.mockReset();
    aggregateMock.mockReset();
    countDocumentsMock.mockResolvedValue(150);
    aggregateMock
      .mockReturnValueOnce({ toArray: () => Promise.resolve(byTypeFixture) })
      .mockReturnValueOnce({ toArray: () => Promise.resolve([
        { userId: 'user-1', count: 50 },
        { userId: 'user-2', count: 30 },
      ]) });

    const res = await request(app).get('/metrics');

    expect(res.status).toBe(200);
    expect(res.body.topUsers).toHaveLength(2);
    expect(res.body.topUsers).toEqual([
      { userId: 'user-1', count: 50 },
      { userId: 'user-2', count: 30 },
    ]);
  });

  it('returns 500 when MongoDB throws', async () => {
    countDocumentsMock.mockRejectedValueOnce(new Error('Mongo unavailable'));

    const res = await request(app).get('/metrics');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to fetch metrics');
  });
});

describe('GET /metrics/timeline', () => {
  beforeEach(() => {
    // Cancela los mockReturnValueOnce del beforeEach de nivel raíz para que
    // los tests de este describe partan con el mock limpio
    countDocumentsMock.mockReset();
    aggregateMock.mockReset();
  });

  it('returns 200 with data and range for default (24h)', async () => {
    aggregateMock.mockReturnValueOnce({ toArray: () => Promise.resolve([
      { _id: 8,  count: 3 },
      { _id: 12, count: 5 },
    ]) });

    const res = await request(app).get('/metrics/timeline');

    expect(res.status).toBe(200);
    expect(res.body.range).toBe('24h');
    expect(res.body.data).toEqual([
      { timeLabel: '08:00', count: 3 },
      { timeLabel: '12:00', count: 5 },
    ]);
  });

  it('maps single-digit hours to zero-padded HH:00 labels', async () => {
    aggregateMock.mockReturnValueOnce({ toArray: () => Promise.resolve([
      { _id: 0,  count: 1 },
      { _id: 9,  count: 4 },
      { _id: 23, count: 2 },
    ]) });

    const res = await request(app).get('/metrics/timeline').query({ range: '24h' });

    expect(res.body.data).toEqual([
      { timeLabel: '00:00', count: 1 },
      { timeLabel: '09:00', count: 4 },
      { timeLabel: '23:00', count: 2 },
    ]);
  });

  it('returns DD/MM labels for 7d range', async () => {
    aggregateMock.mockReturnValueOnce({ toArray: () => Promise.resolve([
      { _id: '2026-06-04', count: 2 },
      { _id: '2026-06-08', count: 7 },
    ]) });

    const res = await request(app).get('/metrics/timeline').query({ range: '7d' });

    expect(res.status).toBe(200);
    expect(res.body.range).toBe('7d');
    expect(res.body.data).toEqual([
      { timeLabel: '04/06', count: 2 },
      { timeLabel: '08/06', count: 7 },
    ]);
  });

  it('returns DD/MM labels for 30d range', async () => {
    aggregateMock.mockReturnValueOnce({ toArray: () => Promise.resolve([
      { _id: '2026-05-15', count: 10 },
      { _id: '2026-06-01', count: 4 },
    ]) });

    const res = await request(app).get('/metrics/timeline').query({ range: '30d' });

    expect(res.status).toBe(200);
    expect(res.body.range).toBe('30d');
    expect(res.body.data).toEqual([
      { timeLabel: '15/05', count: 10 },
      { timeLabel: '01/06', count: 4 },
    ]);
  });

  it('returns 400 for invalid range value and does not call aggregate', async () => {
    const res = await request(app).get('/metrics/timeline').query({ range: '1y' });

    expect(res.status).toBe(400);
    expect(aggregateMock).not.toHaveBeenCalled();
  });

  it('returns 500 when MongoDB throws', async () => {
    aggregateMock.mockReturnValueOnce({ toArray: () => Promise.reject(new Error('Mongo unavailable')) });

    const res = await request(app).get('/metrics/timeline').query({ range: '24h' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to fetch timeline');
  });
});

describe('GET /metrics/users-distribution', () => {
  beforeEach(() => {
    countDocumentsMock.mockReset();
    aggregateMock.mockReset();
  });

  it('returns 200 with data array', async () => {
    aggregateMock.mockReturnValueOnce({ toArray: () => Promise.resolve([
      { _id: 'user-1', total: 8, types: [{ type: 'click', count: 5 }, { type: 'pageview', count: 3 }] },
      { _id: 'user-2', total: 4, types: [{ type: 'click', count: 4 }] },
    ]) });

    const res = await request(app).get('/metrics/users-distribution');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('returns userId and types sorted alphabetically for each user', async () => {
    aggregateMock.mockReturnValueOnce({ toArray: () => Promise.resolve([
      { _id: 'user-1', total: 8, types: [{ type: 'pageview', count: 3 }, { type: 'click', count: 5 }] },
    ]) });

    const res = await request(app).get('/metrics/users-distribution');

    expect(res.body.data[0].userId).toBe('user-1');
    expect(res.body.data[0].types).toEqual([
      { type: 'click', count: 5 },
      { type: 'pageview', count: 3 },
    ]);
  });

  it('pipeline includes $limit: 3 to cap top users', async () => {
    aggregateMock.mockReturnValueOnce({ toArray: () => Promise.resolve([]) });

    await request(app).get('/metrics/users-distribution');

    const pipeline: unknown[] = aggregateMock.mock.calls[0][0];
    expect(pipeline).toContainEqual({ $limit: 3 });
  });

  it('returns empty data when there are no events', async () => {
    aggregateMock.mockReturnValueOnce({ toArray: () => Promise.resolve([]) });

    const res = await request(app).get('/metrics/users-distribution');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('returns 500 when MongoDB throws', async () => {
    aggregateMock.mockReturnValueOnce({ toArray: () => Promise.reject(new Error('Mongo unavailable')) });

    const res = await request(app).get('/metrics/users-distribution');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to fetch users distribution');
  });
});

describe('GET /metrics/users-activity', () => {
  beforeEach(() => {
    countDocumentsMock.mockReset();
    aggregateMock.mockReset();
  });

  it('returns 200 with data and range for default (24h)', async () => {
    aggregateMock.mockReturnValueOnce({ toArray: () => Promise.resolve([
      { _id: 'user-1', total: 8, hours: [{ hour: 9, count: 3 }, { hour: 14, count: 5 }] },
    ]) });

    const res = await request(app).get('/metrics/users-activity');

    expect(res.status).toBe(200);
    expect(res.body.range).toBe('24h');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].userId).toBe('user-1');
  });

  it('returns 24 zero-filled hour buckets and fills in actual counts for 24h', async () => {
    aggregateMock.mockReturnValueOnce({ toArray: () => Promise.resolve([
      { _id: 'user-1', total: 3, hours: [{ hour: 9, count: 3 }] },
    ]) });

    const res = await request(app).get('/metrics/users-activity').query({ range: '24h' });

    const { hours } = res.body.data[0];
    expect(hours).toHaveLength(24);
    expect(hours[0]).toEqual({ timeLabel: '00:00', count: 0 });
    expect(hours[9]).toEqual({ timeLabel: '09:00', count: 3 });
    expect(hours[23]).toEqual({ timeLabel: '23:00', count: 0 });
  });

  it('returns 7 Spanish day-name buckets for 7d range', async () => {
    aggregateMock.mockReturnValueOnce({ toArray: () => Promise.resolve([
      { _id: 'user-1', total: 5, days: [{ dayOfWeek: 2, count: 3 }, { dayOfWeek: 4, count: 2 }] },
    ]) });

    const res = await request(app).get('/metrics/users-activity').query({ range: '7d' });

    expect(res.status).toBe(200);
    expect(res.body.range).toBe('7d');
    const { hours } = res.body.data[0];
    expect(hours).toHaveLength(7);
    expect(hours[0]).toEqual({ timeLabel: 'Dom', count: 0 }); // dayOfWeek 1 → not in days
    expect(hours[1]).toEqual({ timeLabel: 'Lun', count: 3 }); // dayOfWeek 2
    expect(hours[3]).toEqual({ timeLabel: 'Mié', count: 2 }); // dayOfWeek 4
    expect(hours[6]).toEqual({ timeLabel: 'Sáb', count: 0 }); // dayOfWeek 7 → not in days
  });

  it('pipeline includes $limit: 5 to cap top users', async () => {
    aggregateMock.mockReturnValueOnce({ toArray: () => Promise.resolve([]) });

    await request(app).get('/metrics/users-activity').query({ range: '24h' });

    const pipeline: unknown[] = aggregateMock.mock.calls[0][0];
    expect(pipeline).toContainEqual({ $limit: 5 });
  });

  it('returns 400 for invalid range value (30d not allowed) and does not call aggregate', async () => {
    const res = await request(app).get('/metrics/users-activity').query({ range: '30d' });

    expect(res.status).toBe(400);
    expect(aggregateMock).not.toHaveBeenCalled();
  });

  it('returns 500 when MongoDB throws', async () => {
    aggregateMock.mockReturnValueOnce({ toArray: () => Promise.reject(new Error('Mongo unavailable')) });

    const res = await request(app).get('/metrics/users-activity').query({ range: '24h' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to fetch users activity');
  });
});
