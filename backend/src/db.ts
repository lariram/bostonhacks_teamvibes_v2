import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { AVATAR_COLORS } from './data/meta.js';
import { DEMO_LOCALS, SEED_POSTS } from './data/seedUsers.js';
import type { DbShape, User } from './types.js';

/**
 * Tiny JSON-file database. Good enough for a hackathon: one process, everything
 * in memory, flushed to disk shortly after each change. Pass `null` as the file
 * for a purely in-memory store (used by tests).
 */
export class Db {
  data: DbShape;
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(private file: string | null) {
    this.data = this.load() ?? seed();
    this.save();
  }

  private load(): DbShape | null {
    if (!this.file || !fs.existsSync(this.file)) return null;
    try {
      return JSON.parse(fs.readFileSync(this.file, 'utf8')) as DbShape;
    } catch (err) {
      console.warn(`Could not read ${this.file}, starting fresh:`, err);
      return null;
    }
  }

  /** Schedule a write to disk (debounced). */
  save() {
    if (!this.file) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flush(), 50);
  }

  flush() {
    if (!this.file) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }

  user(id: string): User | undefined {
    return this.data.users.find((u) => u.id === id);
  }
}

export const newId = (prefix: string) => `${prefix}_${crypto.randomBytes(6).toString('hex')}`;

function seed(): DbShape {
  const now = Date.now();
  const users: User[] = DEMO_LOCALS.map((d, i) => ({
    id: d.id,
    fullName: d.fullName,
    username: d.username,
    email: `${d.username}@demo.local`,
    age: d.age,
    bio: d.bio,
    school: d.school,
    passwordHash: '', // demo locals can't log in
    preferences: d.preferences,
    tagWeights: {},
    wantIds: [],
    lastPrice: d.budget,
    isDemo: true,
    avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
    createdAt: new Date(now - 1000 * 60 * 60 * 24 * 30).toISOString(),
  }));

  const posts = SEED_POSTS.map((p, i) => ({
    id: `post_seed_${i}`,
    userId: p.userId,
    placeId: p.placeId,
    rating: p.rating,
    caption: p.caption,
    // a few likes from other locals so the feed has some life
    likes: DEMO_LOCALS.filter((_, j) => (i + j) % 4 === 0 && DEMO_LOCALS[j].id !== p.userId).map((d) => d.id),
    wants: [],
    createdAt: new Date(now - p.hoursAgo * 60 * 60 * 1000).toISOString(),
  }));

  return { users, sessions: {}, plans: [], groups: [], messages: [], posts };
}
