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
