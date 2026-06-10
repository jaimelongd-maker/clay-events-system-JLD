import axios from 'axios';
import { EventItem, Metrics } from './types';

const BASE_URL = 'http://localhost:3001';

export async function fetchEvents(eventType?: string): Promise<EventItem[]> {
  const params = new URLSearchParams();
  if (eventType) params.set('eventType', eventType);
  const query = params.toString() ? `?${params}` : '';
  const res = await axios.get<{ events: EventItem[] }>(`${BASE_URL}/events${query}`);
  return res.data.events;
}

export async function fetchMetrics(): Promise<Metrics> {
  const res = await axios.get<Metrics>(`${BASE_URL}/metrics`);
  return res.data;
}

export async function postEvent(event: Omit<EventItem, '_id'>): Promise<void> {
  await axios.post(`${BASE_URL}/events`, event);
}

export async function deleteAllEvents(): Promise<void> {
  await axios.delete(`${BASE_URL}/events`);
}
