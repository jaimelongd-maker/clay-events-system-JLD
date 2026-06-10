export interface EventItem {
  _id: string; // ObjectId de MongoDB, serializado como string hexadecimal de 24 chars
  eventType: string;
  userId: string;
  sessionId: string;
  timestamp: number;
  metadata: {
    page: string;
    action: string;
    component: string;
  };
}

export interface Metrics {
  totalEvents: number;
  eventsByType: Record<string, number>;
  topUsers: { userId: string; count: number }[];
}
