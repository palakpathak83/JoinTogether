import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createExpressApp } from '../../server/app.ts';
import { connectDatabase, disconnectDatabase } from '../../server/config/db.ts';
import { initSocketServer } from '../../server/socket/index.ts';

async function bootE2EServer() {
  process.env.NODE_ENV = 'test';
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGODB_URI = uri;

  await connectDatabase(uri);

  const app = createExpressApp();
  const httpServer = http.createServer(app);
  initSocketServer(httpServer);

  const distDir = path.resolve(process.cwd(), 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  await new Promise<void>((resolve) => {
    httpServer.listen(3100, '127.0.0.1', () => {
      console.log('E2E test server listening on http://127.0.0.1:3100');
      resolve();
    });
  });

  const shutdown = async () => {
    httpServer.close();
    await disconnectDatabase();
    await mongod.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootE2EServer().catch((err) => {
  console.error('E2E server error:', err);
  process.exit(1);
});
