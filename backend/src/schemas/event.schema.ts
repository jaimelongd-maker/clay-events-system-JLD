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

// z.coerce.number() convierte el string que llega en query param a número antes de validar
export const EventQuerySchema = z.object({
  eventType: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  fromTimestamp: z.coerce.number().int().positive().optional(),
  toTimestamp: z.coerce.number().int().positive().optional(),
}).refine(
  ({ fromTimestamp, toTimestamp }) =>
    fromTimestamp === undefined || toTimestamp === undefined || fromTimestamp <= toTimestamp,
  { message: 'fromTimestamp must be less than or equal to toTimestamp', path: ['fromTimestamp'] },
);

export type EventQuery = z.infer<typeof EventQuerySchema>;
