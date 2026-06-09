import { z } from 'zod';

export const EventSchema = z.object({
  eventType: z.string().min(1),
  userId: z.string().min(1),
  sessionId: z.string().min(1),
  timestamp: z.number().int().positive(),
  metadata: z.object({
    page: z.string().min(1),
    action: z.string().min(1),
    component: z.string().min(1),
  }),
});

export type Event = z.infer<typeof EventSchema>;
