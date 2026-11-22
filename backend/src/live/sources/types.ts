import type { Place } from '../../types.js';

export interface SourceContext {
  /** Boston date, YYYY-MM-DD */
  today: string;
  /** Last Boston date to fetch (inclusive), YYYY-MM-DD */
  endDate: string;
  /** How many days that is, today included */
  days: number;
  dayStart: Date;
  /** End of the last day in range */
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
