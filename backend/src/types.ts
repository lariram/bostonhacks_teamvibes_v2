// Shared domain types for the API.

export type PlaceType = 'event' | 'activity' | 'food';

export type PriceTier = 'free' | 'under10' | '10to20' | '20to40' | '40plus';

export type DurationId = 'quick' | 'short' | 'half' | 'day';

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'late';

export type NeighborhoodId =
  | 'downtown'
  | 'theater'
  | 'chinatown'
  | 'northend'
  | 'backbay'
  | 'fenway'
  | 'seaport'
  | 'charlestown'
  | 'cambridge'
  | 'somerville'
  | 'allston'
  | 'brighton';

export interface Place {
  id: string;
  name: string;
  type: PlaceType;
  neighborhood: NeighborhoodId;
  price: PriceTier;
  /** Human-friendly cost note, e.g. "~$12 a bowl" */
  priceNote: string;
  /** Typical time spent, in minutes */
  minutes: number;
  /** Preference tags this place satisfies (see PREFERENCE_TAGS) */
  tags: string[];
  /** When it's a good time to go */
  times: TimeOfDay[];
  /** Months (1-12) it's available; omitted = year-round */
  months?: number[];
  address: string;
  lat: number;
  lng: number;
  /** Nearest MBTA stop / line */
  tStop: string;
  emoji: string;
  blurb: string;
  /** "Only a Bostonian would tell you this" tip */
  localTip: string;
  /** Set for real, dated events pulled from live sources (today only) */
  live?: LiveInfo;
}

export type LiveSourceId = 'ticketmaster' | 'localist' | 'community' | 'google';

export interface LiveInfo {
  source: LiveSourceId;
  /** Human-readable source, e.g. "Ticketmaster" or "MIT Events" */
  sourceName: string;
  /** Event page on the source site */
  url: string;
  /** Ticket link, when different from the event page */
  ticketUrl?: string;
  /** ISO timestamps */
  startsAt: string;
  endsAt?: string;
  /** End time is our estimate, not from the listing */
  endEstimated?: boolean;
  /** The listing has a date but no time */
  timeTBA?: boolean;
  venue?: string;
  /** University calendar: may be campus-only */
  campus?: boolean;
  /** Pin is the neighborhood center, not the exact venue */
  approxLocation?: boolean;
  fetchedAt: string;
}

export interface Preferences {
  food: string[];
  event: string[];
  activity: string[];
}

export interface User {
  id: string;
  fullName: string;
  username: string;
  email: string;
  age: number;
  bio?: string;
  school?: string;
  passwordHash: string;
  preferences: Preferences;
  /** Learned tag affinities in [-1, 1], adjusted by ratings, feedback and feed reactions */
  tagWeights: Record<string, number>;
  /** Places saved from the feed ("want to try") */
  wantIds: string[];
  /** Last budget this user chose; used to cap group budgets */
  lastPrice?: PriceTier;
  /** Simulated locals that make the demo feel alive */
  isDemo?: boolean;
  /** One-tap demo account (no email/password) */
  isGuest?: boolean;
  avatarColor: string;
  createdAt: string;
}

export interface RecRequest {
  location: NeighborhoodId | 'anywhere';
  type: PlaceType;
  price: PriceTier;
  duration: DurationId;
  timeOfDay?: TimeOfDay;
  groupMode?: boolean;
  groupId?: string;
  excludeIds?: string[];
  feedback?: RecFeedback;
}

export interface RecFeedback {
  /** Tags the user said they want more of */
  moreTags?: string[];
  cheaper?: boolean;
  closer?: boolean;
  /** Steer away from whatever was shown last time */
  different?: boolean;
}

export interface Suggestion {
  place: Place;
  score: number;
  reasons: string[];
  /** Set when we had to stretch a constraint to find a match */
  stretchNote?: string;
  communityRating?: { avg: number; count: number };
}

export type PlanStatus = 'active' | 'completed';

export interface Plan {
  id: string;
  userId: string;
  placeId: string;
  request: RecRequest;
  groupId?: string;
  status: PlanStatus;
  rating?: number;
  /** Private review — only visible to the author */
  review?: string;
  postId?: string;
  createdAt: string;
  completedAt?: string;
}

export type GroupStatus = 'forming' | 'active' | 'ended';

export interface GroupActivity {
  placeId: string;
  byUserId: string;
  at: string;
}

export interface Group {
  id: string;
  name: string;
  memberIds: string[];
  status: GroupStatus;
  /** Where the crew first met */
  originPlaceId: string;
  activities: GroupActivity[];
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  groupId: string;
  userId: string;
  text: string;
  at: string;
}

export interface FeedPost {
  id: string;
  userId: string;
  placeId: string;
  planId?: string;
  rating: number;
  caption?: string;
  groupId?: string;
  likes: string[];
  wants: string[];
  createdAt: string;
}

export interface DbShape {
  users: User[];
  sessions: Record<string, string>; // token -> userId
  plans: Plan[];
  groups: Group[];
  messages: ChatMessage[];
  posts: FeedPost[];
  /** Snapshots of live events someone picked, so history works after they leave the cache */
  livePlaces: Record<string, Place>;
}
