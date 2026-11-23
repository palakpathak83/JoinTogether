import mongoose from 'mongoose';
import { getEnv } from './env.ts';

mongoose.set('strictQuery', true);

export type DbConnectionState = 'connected' | 'connecting' | 'disconnected' | 'unconfigured';

let lastDbError: string | null = null;

export async function connectDatabase(explicitUri?: string): Promise<boolean> {
  const uri = (explicitUri ?? getEnv().mongodbUri).trim();
  if (!uri) {
    lastDbError = 'MONGODB_URI is not configured';
    return false;
  }

  if (mongoose.connection.readyState === 1) {
    lastDbError = null;
    return true;
  }

  try {
    await mongoose.connect(uri, {
      dbName: getEnv().mongodbDbName,
      serverSelectionTimeoutMS: 5000,
    });
    lastDbError = null;
    return true;
  } catch (err) {
    lastDbError = err instanceof Error ? err.message : 'MongoDB connection failed';
    console.error('MongoDB connection error:', lastDbError);
    return false;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export function getDbStatus(): {
  state: DbConnectionState;
  readyState: number;
  error: string | null;
} {
  const readyState = mongoose.connection.readyState;
  const uri = getEnv().mongodbUri;

  if (!uri && readyState === 0) {
    return {
      state: 'unconfigured',
      readyState,
      error: lastDbError ?? 'MONGODB_URI is not configured',
    };
  }

  if (readyState === 1) {
    return { state: 'connected', readyState, error: null };
  }
  if (readyState === 2) {
    return { state: 'connecting', readyState, error: lastDbError };
  }
  return { state: 'disconnected', readyState, error: lastDbError };
}
