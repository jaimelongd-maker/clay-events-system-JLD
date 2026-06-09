import { MongoClient, Db } from 'mongodb';
import { config } from '../config';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

let client: MongoClient | null = null;

export async function connectMongo(retries = MAX_RETRIES): Promise<void> {
  try {
    client = new MongoClient(config.mongoUri);
    await client.connect();
    console.log('MongoDB connected');
  } catch (err) {
    if (retries === 0) throw new Error(`MongoDB connection failed after ${MAX_RETRIES} retries`);
    console.warn(`MongoDB unavailable, retrying in ${RETRY_DELAY_MS}ms... (${retries} left)`);
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    return connectMongo(retries - 1);
  }
}

export function getDb(): Db {
  if (!client) throw new Error('MongoDB not connected');
  return client.db();
}

export async function closeMongo(): Promise<void> {
  if (client) await client.close();
}

// Hace un ping real — más fiable que trackear estado interno
export async function isMongoConnected(): Promise<boolean> {
  if (!client) return false;
  try {
    await client.db().command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}
