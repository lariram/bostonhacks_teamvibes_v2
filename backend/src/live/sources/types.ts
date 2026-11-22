import type { Place } from '../../types.js';

export interface SourceContext {
  /** Boston date, YYYY-MM-DD */
  today: string;
  dayStart: Date;
  dayEnd: Date;
  now: Date;
  getJson: (url: string) => Promise<unknown>;
}

export interface LiveSource {
  id: string;
  name: string;
  /** How often to re-fetch */
  refreshMs: number;
  fetch: (ctx: SourceContext) => Promise<Place[]>;
}
