import axios from 'axios';
import { fetchEvents, fetchMetrics, postEvent, deleteAllEvents } from '../api';
import { EventItem, Metrics } from '../types';

jest.mock('axios');

const mockedGet    = jest.mocked(axios.get);
const mockedPost   = jest.mocked(axios.post);
const mockedDelete = jest.mocked(axios.delete);

const BASE = 'http://localhost:3001';

const mockEvent: Omit<EventItem, '_id'> = {
  eventType: 'click',
  userId: 'user-1',
  sessionId: 'session-1',
  timestamp: 1749500000000,
  metadata: { page: '/home', action: 'click_button', component: 'button' },
};

const mockMetrics: Metrics = {
  totalEvents: 5,
  eventsByType: { click: 3, view: 2 },
  topUsers: [{ userId: 'user-1', count: 3 }],
};

afterEach(() => jest.clearAllMocks());

describe('fetchEvents', () => {
  it('calls axios.get without a query string when no eventType is provided', async () => {
    mockedGet.mockResolvedValue({ data: { events: [] } });

    await fetchEvents();

    expect(mockedGet).toHaveBeenCalledWith(`${BASE}/events`);
  });

  it('calls axios.get with ?eventType=click when eventType is "click"', async () => {
    mockedGet.mockResolvedValue({ data: { events: [] } });

    await fetchEvents('click');

    expect(mockedGet).toHaveBeenCalledWith(`${BASE}/events?eventType=click`);
  });

  it('returns the events array from res.data.events', async () => {
    const events = [{ ...mockEvent, _id: 'abc' }];
    mockedGet.mockResolvedValue({ data: { events } });

    const result = await fetchEvents();

    expect(result).toEqual(events);
  });

  it('does not include a query string when eventType is undefined', async () => {
    mockedGet.mockResolvedValue({ data: { events: [] } });

    await fetchEvents(undefined);

    const calledUrl = mockedGet.mock.calls[0][0] as string;
    expect(calledUrl).not.toContain('?');
  });
});

describe('fetchMetrics', () => {
  it('calls axios.get on the /metrics endpoint', async () => {
    mockedGet.mockResolvedValue({ data: mockMetrics });

    await fetchMetrics();

    expect(mockedGet).toHaveBeenCalledWith(`${BASE}/metrics`);
  });

  it('returns res.data directly', async () => {
    mockedGet.mockResolvedValue({ data: mockMetrics });

    const result = await fetchMetrics();

    expect(result).toEqual(mockMetrics);
  });
});

describe('postEvent', () => {
  it('calls axios.post on /events with the event as the body', async () => {
    mockedPost.mockResolvedValue({});

    await postEvent(mockEvent);

    expect(mockedPost).toHaveBeenCalledWith(`${BASE}/events`, mockEvent);
  });
});

describe('deleteAllEvents', () => {
  it('calls axios.delete on /events', async () => {
    mockedDelete.mockResolvedValue({});

    await deleteAllEvents();

    expect(mockedDelete).toHaveBeenCalledWith(`${BASE}/events`);
  });
});
