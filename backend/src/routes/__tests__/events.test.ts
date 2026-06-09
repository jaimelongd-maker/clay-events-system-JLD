import express from 'express';
import request from 'supertest';

const lpushMock = jest.fn();

jest.mock('../../infrastructure/redis', () => ({
  getRedisClient: () => ({ lpush: lpushMock }),
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

  it('does not call lpush when validation fails', async () => {
    await request(app).post('/events').send({ eventType: 'click' });

    expect(lpushMock).not.toHaveBeenCalled();
  });

  it('returns 400 when payload is empty', async () => {
    const res = await request(app).post('/events').send({});

    expect(res.status).toBe(400);
    expect(res.body.errors.fieldErrors).toBeDefined();
  });

  it('returns 500 when Redis throws', async () => {
    lpushMock.mockRejectedValueOnce(new Error('Redis unavailable'));

    const res = await request(app).post('/events').send(validEvent);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to enqueue event');
  });
});
