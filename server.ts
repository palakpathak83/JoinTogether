import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { createExpressApp } from './server/app.ts';
import { connectDatabase } from './server/config/db.ts';
import { getEnv } from './server/config/env.ts';
import { initSocketServer } from './server/socket/index.ts';

async function startServer() {
  const { port, nodeEnv, mongodbUri } = getEnv();
  const app = createExpressApp();
  const httpServer = http.createServer(app);

  initSocketServer(httpServer);

  if (mongodbUri) {
    const connected = await connectDatabase(mongodbUri);
    if (connected) {
      console.log('MongoDB connected successfully.');
    } else {
      console.warn('MongoDB connection failed. Server running in degraded mode until database is reachable.');
    }
  } else {
    console.warn('MONGODB_URI is not set. Database endpoints will return 503 until MONGODB_URI is configured.');
  }

  if (nodeEnv !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`JoinTogether server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup failure:', err);
  process.exit(1);
});
