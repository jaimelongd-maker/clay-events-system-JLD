import express from 'express';
import request from 'supertest';

const lpushMock = jest.fn();
const delMock = jest.fn();
const toArrayMock = jest.fn();
const deleteManyMock = jest.fn();
const cursorMock = {
  sort: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  toArray: toArrayMock,
};
const findMock = jest.fn().mockReturnValue(cursorMock);

jest.mock('../../infrastructure/redis', () => ({
  getRedisClient: () => ({ lpush: lpushMock, del: delMock }),
}));
jest.mock('../../infrastructure/mongo', () => ({
  getDb: () => ({ collection: () => ({ find: findMock, deleteMany: deleteManyMock }) }),
}));

import eventsRouter from '../events';

const app = express();
app.use(express.json());
app.use(eventsRouter);

const validEvent = {
  eventType: 'click',
  userId: 'user-1',
  sessionId: 'session-abc',
  timestamp: 1700000000000,
  metadata: { page: '/home', action: 'click', component: 'button' },
};

describe('POST /events', () => {
  beforeEach(() => lpushMock.mockResolvedValue(1));
  afterEach(() => jest.clearAllMocks());

  it('returns 202 and enqueues a valid event', async () => {
    const res = await request(app).post('/events').send(validEvent);

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ queued: true });
    expect(lpushMock).toHaveBeenCalledWith('events:queue', JSON.stringify(validEvent));
  });

  it('returns 400 when eventType is missing', async () => {
    const { eventType: _, ...body } = validEvent;
    const res = await request(app).post('/events').send(body);

    expect(res.status).toBe(400);
    expect(res.body.errors.fieldErrors).toHaveProperty('eventType');
  });

  it('returns 400 when timestamp is a string', async () => {
    const res = await request(app).post('/events').send({ ...validEvent, timestamp: 'not-a-number' });

    expect(res.status).toBe(400);
    expect(res.body.errors.fieldErrors).toHaveProperty('timestamp');
  });

  it('returns 400 when a metadata field is missing', async () => {
    const { metadata: { action: _, ...meta }, ...rest } = validEvent;
    const res = await request(app).post('/events').send({ ...rest, metadata: meta });

    expect(res.status).toBe(400);
    expect(res.body.errors.fieldErrors).toHaveProperty('metadata');
  });

  it('returns 400 when payload is empty', async () => {
    const res = await request(app).post('/events').send({});

    expect(res.status).toBe(400);
    expect(res.body.errors.fieldErrors).toBeDefined();
  });

  it('does not call lpush when validation fails', async () => {
    await request(app).post('/events').send({ eventType: 'click' });

    expect(lpushMock).not.toHaveBeenCalled();
  });

  it('returns 500 when Redis throws', async () => {
    lpushMock.mockRejectedValueOnce(new Error('Redis unavailable'));

    const res = await request(app).post('/events').send(validEvent);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to enqueue event');
  });
});

describe('GET /events', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns 200 with events when no filters are provided', async () => {
    toArrayMock.mockResolvedValue([validEvent]);

    const res = await request(app).get('/events');

    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(1);
    expect(findMock).toHaveBeenCalledWith({});
  });

  it('filters by eventType', async () => {
    toArrayMock.mockResolvedValue([]);

    await request(app).get('/events').query({ eventType: 'click' });

    expect(findMock).toHaveBeenCalledWith({ eventType: 'click' });
  });

  it('filters by userId', async () => {
    toArrayMock.mockResolvedValue([]);

    await request(app).get('/events').query({ userId: 'user-1' });

    expect(findMock).toHaveBeenCalledWith({ userId: 'user-1' });
  });

  it('filters by timestamp range', async () => {
    toArrayMock.mockResolvedValue([]);

    await request(app).get('/events').query({ fromTimestamp: '1000', toTimestamp: '2000' });

    expect(findMock).toHaveBeenCalledWith({
      timestamp: { $gte: 1000, $lte: 2000 },
    });
  });

  it('applies sort by timestamp descending and limit 20', async () => {
    toArrayMock.mockResolvedValue([]);

    await request(app).get('/events');

    expect(cursorMock.sort).toHaveBeenCalledWith({ timestamp: -1 });
    expect(cursorMock.limit).toHaveBeenCalledWith(20);
  });

  it('filters by multiple criteria at once', async () => {
    toArrayMock.mockResolvedValue([validEvent]);

    const res = await request(app).get('/events').query({
      eventType: 'click',
      userId: 'user-1',
      fromTimestamp: '1000',
      toTimestamp: '2000',
    });

    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(1);
    expect(res.body.events[0]).toMatchObject(validEvent);
    expect(findMock).toHaveBeenCalledWith({
      eventType: 'click',
      userId: 'user-1',
      timestamp: { $gte: 1000, $lte: 2000 },
    });
  });

  it('returns 400 when fromTimestamp is not a number', async () => {
    const res = await request(app).get('/events').query({ fromTimestamp: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.errors.fieldErrors).toHaveProperty('fromTimestamp');
  });

  it('returns 400 when fromTimestamp is negative', async () => {
    const res = await request(app).get('/events').query({ fromTimestamp: '-1' });

    expect(res.status).toBe(400);
    expect(res.body.errors.fieldErrors).toHaveProperty('fromTimestamp');
  });

  it('returns 400 when fromTimestamp is greater than toTimestamp', async () => {
    const res = await request(app).get('/events').query({ fromTimestamp: '2000', toTimestamp: '1000' });

    expect(res.status).toBe(400);
    expect(res.body.errors.fieldErrors).toHaveProperty('fromTimestamp');
  });

  it('returns 500 when MongoDB throws', async () => {
    toArrayMock.mockRejectedValueOnce(new Error('Mongo unavailable'));

    const res = await request(app).get('/events');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to query events');
  });
});

describe('DELETE /events', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns 200 and clears MongoDB and Redis', async () => {
    deleteManyMock.mockResolvedValue({ deletedCount: 50 });
    delMock.mockResolvedValue(1);

    const res = await request(app).delete('/events');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: true });
    expect(deleteManyMock).toHaveBeenCalledWith({});
    expect(delMock).toHaveBeenCalledWith('events:queue');
  });

  it('returns 500 when MongoDB throws', async () => {
    deleteManyMock.mockRejectedValueOnce(new Error('Mongo unavailable'));
    delMock.mockResolvedValue(1);

    const res = await request(app).delete('/events');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to clear events');
  });
});
