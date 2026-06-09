import express from 'express';
import request from 'supertest';
import healthRouter from '../health';

// jest.mock es el equivalente a Moq.Setup() — sustituye el módulo real por uno controlado
jest.mock('../../infrastructure/mongo', () => ({
  isMongoConnected: jest.fn(),
}));
jest.mock('../../infrastructure/redis', () => ({
  isRedisConnected: jest.fn(),
}));

import { isMongoConnected } from '../../infrastructure/mongo';
import { isRedisConnected } from '../../infrastructure/redis';

const mongoMock = isMongoConnected as jest.MockedFunction<typeof isMongoConnected>;
const redisMock = isRedisConnected as jest.MockedFunction<typeof isRedisConnected>;

const app = express();
app.use(healthRouter);

describe('GET /health', () => {
  it('returns 200 when both services are up', async () => {
    mongoMock.mockResolvedValue(true);
    redisMock.mockResolvedValue(true);

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', checks: { mongo: true, redis: true } });
  });

  it('returns 503 when MongoDB is down', async () => {
    mongoMock.mockResolvedValue(false);
    redisMock.mockResolvedValue(true);

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.checks.mongo).toBe(false);
  });

  it('returns 503 when Redis is down', async () => {
    mongoMock.mockResolvedValue(true);
    redisMock.mockResolvedValue(false);

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.checks.redis).toBe(false);
  });

  it('returns 503 when both services are down', async () => {
    mongoMock.mockResolvedValue(false);
    redisMock.mockResolvedValue(false);

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body.checks).toEqual({ mongo: false, redis: false });
  });

  it('returns 503 when isMongoConnected throws', async () => {
    mongoMock.mockRejectedValue(new Error('Mongo unreachable'));
    redisMock.mockResolvedValue(true);

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body.checks.mongo).toBe(false);
  });

  it('returns 503 when isRedisConnected throws', async () => {
    mongoMock.mockResolvedValue(true);
    redisMock.mockRejectedValue(new Error('Redis unreachable'));

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body.checks.redis).toBe(false);
  });
});
