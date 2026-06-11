const insertOneMock = jest.fn();
const createIndexMock = jest.fn().mockResolvedValue(undefined);
const brpopMock = jest.fn();

jest.mock('../../infrastructure/mongo', () => ({
  getDb: () => ({
    collection: () => ({ insertOne: insertOneMock, createIndex: createIndexMock }),
  }),
}));
jest.mock('../../infrastructure/redis', () => ({
  getRedisClient: () => ({ brpop: brpopMock }),
}));

import { processEvent, saveWithRetry, createIndexes, consume } from '../consumer';

const validEvent = {
  eventType: 'click',
  userId: 'user-1',
  sessionId: 'session-abc',
  timestamp: 1700000000000,
  metadata: { page: '/home', action: 'click', component: 'button' },
};

beforeEach(() => jest.clearAllMocks());

describe('processEvent', () => {
  it('inserts a valid event into MongoDB', async () => {
    insertOneMock.mockResolvedValue({ insertedId: 'id-1' });

    await processEvent(JSON.stringify(validEvent));

    expect(insertOneMock).toHaveBeenCalledWith(validEvent);
  });

  it('discards and logs when JSON is invalid', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await processEvent('not-valid-json{');

    expect(insertOneMock).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('invalid JSON'), expect.anything());
    spy.mockRestore();
  });

  it('discards and logs when schema validation fails', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const invalid = { ...validEvent, timestamp: 'not-a-number' };

    await processEvent(JSON.stringify(invalid));

    expect(insertOneMock).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('schema invalid'), expect.anything());
    spy.mockRestore();
  });
});

describe('saveWithRetry', () => {
  it('retries on failure and succeeds on second attempt', async () => {
    insertOneMock
      .mockRejectedValueOnce(new Error('DB unavailable'))
      .mockResolvedValueOnce({ insertedId: 'id-1' });

    await saveWithRetry(validEvent, 1);

    expect(insertOneMock).toHaveBeenCalledTimes(2);
  });

  it('discards event after exhausting all retries', async () => {
    insertOneMock.mockRejectedValue(new Error('DB unavailable'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await saveWithRetry(validEvent, 0);

    expect(spy).toHaveBeenCalledWith(expect.stringContaining('discarding'), expect.anything());
    spy.mockRestore();
  });
});

describe('createIndexes', () => {
  it('creates indexes for eventType, userId and timestamp', async () => {
    await createIndexes();

    expect(createIndexMock).toHaveBeenCalledTimes(3);
    expect(createIndexMock).toHaveBeenCalledWith({ eventType: 1 });
    expect(createIndexMock).toHaveBeenCalledWith({ userId: 1 });
    expect(createIndexMock).toHaveBeenCalledWith({ timestamp: -1 });
  });
});

describe('consume', () => {
  it('processes one event and stops when isRunning returns false', async () => {
    insertOneMock.mockResolvedValue({ insertedId: 'id-1' });
    brpopMock.mockResolvedValue(['events:queue', JSON.stringify(validEvent)]);

    let calls = 0;
    await consume(() => calls++ < 1);

    expect(insertOneMock).toHaveBeenCalledTimes(1);
  });

  it('continues loop on null (brpop timeout)', async () => {
    insertOneMock.mockResolvedValue({ insertedId: 'id-1' });
    brpopMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(['events:queue', JSON.stringify(validEvent)]);

    let calls = 0;
    await consume(() => calls++ < 2);

    expect(insertOneMock).toHaveBeenCalledTimes(1);
  });

  it('logs the error and continues when brpop throws', async () => {
    jest.useFakeTimers();
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    brpopMock
      .mockRejectedValueOnce(new Error('Redis connection lost'))
      .mockResolvedValueOnce(['events:queue', JSON.stringify(validEvent)]);
    insertOneMock.mockResolvedValue({ insertedId: 'id-1' });

    let calls = 0;
    const consumePromise = consume(() => calls++ < 2);

    // El catch espera 3 s antes de reintentar; avanzamos el timer para no bloquear
    await jest.runAllTimersAsync();
    await consumePromise;

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('Queue error'),
      'Redis connection lost',
    );
    // Tras recuperarse procesa el evento del segundo brpop
    expect(insertOneMock).toHaveBeenCalledTimes(1);

    spy.mockRestore();
    jest.useRealTimers();
  });
});
