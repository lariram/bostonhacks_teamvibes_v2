import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { Db } from './db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dbFile = process.env.DB_FILE ?? path.join(here, '..', 'data', 'db.json');
const port = Number(process.env.PORT ?? 3001);

const db = new Db(dbFile);
const app = createApp(db);

// In production, serve the built frontend from the same server (npm run build first)
const webDist = path.join(here, '..', '..', 'frontend', 'dist');
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
  console.log(`Serving web app from ${webDist}`);
}

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port} (data: ${dbFile})`);
});

// Make sure pending writes hit disk on Ctrl+C
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    db.flush();
    process.exit(0);
  });
}
