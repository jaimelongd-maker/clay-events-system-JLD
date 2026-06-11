import axios from 'axios';
import { EventItem, Metrics } from './types';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

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

export async function fetchTimeline(range: '24h' | '7d' | '30d'): Promise<Array<{ timeLabel: string; count: number }>> {
  const res = await axios.get<{ data: Array<{ timeLabel: string; count: number }> }>(`${BASE_URL}/metrics/timeline?range=${range}`);
  return res.data.data;
}

export function isRateLimitError(err: unknown): boolean {
  return axios.isAxiosError(err) && err.response?.status === 429;
}

export async function fetchUsersDistribution(): Promise<Array<{
  userId: string;
  types: Array<{ type: string; count: number }>;
}>> {
  const res = await axios.get<{ data: Array<{ userId: string; types: Array<{ type: string; count: number }> }> }>(`${BASE_URL}/metrics/users-distribution`);
  return res.data.data;
}
