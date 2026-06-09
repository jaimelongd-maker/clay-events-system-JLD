import { connectMongo, closeMongo } from './infrastructure/mongo';
import { getRedisClient } from './infrastructure/redis';
import { createIndexes, consume } from './worker/consumer';

let running = true;

async function shutdown(signal: string): Promise<void> {
  console.log(`${signal} received, stopping worker...`);
  running = false;
  // Espera a que el BRPOP actual expire (timeout 5s) + margen
  await new Promise(resolve => setTimeout(resolve, 6000));
  await closeMongo();
  getRedisClient().disconnect();
  console.log('Worker shutdown complete');
  process.exit(0);
}

async function bootstrap(): Promise<void> {
  await connectMongo();
  getRedisClient();
  await createIndexes();

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  await consume(() => running);
}

bootstrap().catch(err => {
  console.error('Fatal worker error:', err);
  process.exit(1);
});
