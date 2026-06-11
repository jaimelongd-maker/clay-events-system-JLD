import { Server } from 'http';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config';
import { connectMongo, closeMongo } from './infrastructure/mongo';
import { getRedisClient } from './infrastructure/redis';
import healthRouter from './routes/health';
import eventsRouter from './routes/events';
import metricsRouter from './routes/metrics';

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3002' }));
app.use(express.json());
app.use(healthRouter);
app.use(eventsRouter);
app.use(metricsRouter);

// Analogía .NET: equivalente a IHostApplicationLifetime.ApplicationStopping
async function shutdown(server: Server, signal: string): Promise<void> {
  console.log(`${signal} received, shutting down...`);

  // 1. Dejar de aceptar requests nuevos (pero terminar los en vuelo)
  server.close(async () => {
    await closeMongo();
    getRedisClient().disconnect();
    console.log('Shutdown complete');
    process.exit(0);
  });

  // Safety net: si algo tarda más de 9s, forzamos salida antes de que Docker mande SIGKILL
  setTimeout(() => {
    console.error('Graceful shutdown timeout, forcing exit');
    process.exit(1);
  }, 9000);
}

async function bootstrap(): Promise<void> {
  await connectMongo();
  getRedisClient();

  const server = app.listen(config.port, () =>
    console.log(`Server running on port ${config.port}`)
  );

  process.on('SIGTERM', () => shutdown(server, 'SIGTERM'));
  process.on('SIGINT', () => shutdown(server, 'SIGINT'));
}

bootstrap().catch(err => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
