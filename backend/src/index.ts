import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { Db } from './db.js';
import { LiveEvents, liveSourcesFromEnv } from './live/liveEvents.js';
import { Images } from './images.js';

const here = path.dirname(fileURLToPath(import.meta.url));

// API keys etc. live in backend/.env (see .env.example); it's optional
const envFile = path.join(here, '..', '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
const dbFile = process.env.DB_FILE ?? path.join(here, '..', 'data', 'db.json');
const port = Number(process.env.PORT ?? 3001);

const db = new Db(dbFile);

// Today's real events (university calendars by default; more with API keys)
const sources = liveSourcesFromEnv();
const live = sources.length ? new LiveEvents(sources) : null;
live?.start();
console.log(sources.length ? `Live events from: ${sources.map((s) => s.name).join(', ')}` : 'Live events: off (catalog only)');

// Real photos for curated places: Google Places with a key, otherwise Wikipedia/Commons
const images = /^(off|false|0|no)$/i.test(process.env.PHOTOS ?? '') ? null : new Images(db, { googleKey: process.env.GOOGLE_PLACES_API_KEY });
images?.warm();
setInterval(() => images?.warm(), 6 * 60 * 60 * 1000).unref();

const app = createApp(db, { live, images });

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
