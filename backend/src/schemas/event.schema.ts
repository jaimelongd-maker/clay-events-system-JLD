import { z } from 'zod';

export const EventSchema = z.object({
  eventType: z.string().min(1),
  userId: z.string().min(1),
  sessionId: z.string().min(1),
  timestamp: z.number().int().positive(),
  metadata: z.object({
    // page: URLs pathname típicas son <200, SPAs complejas pueden llegar a 500–800.
    // HTTP spec permite 2,083 (IE 6 legacy), limitamos a 1,000 por conservador.
    // Ref: realidad web muestra que >1000 chars es irrazonable.
    page: z.string().min(1).max(1000),

    // action: nombres de acciones en analytics estándar (Firebase 40, Amplitude 256).
    // En realidad button_click, form_submit, etc. nunca superan 50 chars.
    // Limitamos a 100 para compatibilidad con estándares de analytics.
    action: z.string().min(1).max(100),

    // component: component IDs React típicamente <50. Hierarchies complejas
    // (MainLayout.Dashboard.RevenueChart) llegan a 100–150. Limitamos a 200
    // para edge cases, siguiendo convención de component naming.
    component: z.string().min(1).max(200),
  }),
});

export type Event = z.infer<typeof EventSchema>;

// z.coerce.number() convierte el string que llega en query param a número antes de validar
export const EventQuerySchema = z.object({
  eventType: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  fromTimestamp: z.coerce.number().int().positive().optional(),
  toTimestamp: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
}).refine(
  ({ fromTimestamp, toTimestamp }) =>
    fromTimestamp === undefined || toTimestamp === undefined || fromTimestamp <= toTimestamp,
  { message: 'fromTimestamp must be less than or equal to toTimestamp', path: ['fromTimestamp'] },
);

export type EventQuery = z.infer<typeof EventQuerySchema>;
