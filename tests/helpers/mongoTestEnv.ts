import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../../server/config/db.ts';

let mongod: MongoMemoryServer | null = null;

export async function startTestMongo(): Promise<string> {
  process.env.NODE_ENV = 'test';
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGODB_URI = uri;
  await connectDatabase(uri);
  return uri;
}

export async function clearTestMongo(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}

export async function stopTestMongo(): Promise<void> {
  await disconnectDatabase();
  if (mongod) {
    await mongod.stop();
    mongod = null;
  }
}
