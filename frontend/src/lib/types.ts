// Mirrors backend/src/types.ts (kept separate so the two apps stay independent)

export type PlaceType = 'event' | 'activity' | 'food';
export type PriceTier = 'free' | 'under10' | '10to20' | '20to40' | '40plus';
export type DurationId = 'quick' | 'short' | 'half' | 'day';
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'late';
export type Persona = 'student' | 'local' | 'visitor' | 'newcomer';

export interface Option<T extends string = string> {
  id: T;
  label: string;
}

export interface Meta {
  neighborhoods: Option[];
  types: Option<PlaceType>[];
  priceTiers: Option<PriceTier>[];
  durations: Option<DurationId>[];
  timesOfDay: Option<TimeOfDay>[];
  preferenceTags: Record<PlaceType, string[]>;
  durationOptions: number[];
  personas: { id: Persona; label: string; hint: string }[];
  maxPrefsPerCategory: number;
  placeCount: number;
}

export interface Place {
  id: string;
  name: string;
  type: PlaceType;
  neighborhood: string;
  price: PriceTier;
  priceNote: string;
  minutes: number;
  tags: string[];
  times: TimeOfDay[];
  months?: number[];
  address: string;
  lat: number;
  lng: number;
  tStop: string;
  emoji: string;
  blurb: string;
  localTip: string;
  /** Real, dated event from a live source (today only) */
  live?: LiveInfo;
  /** A real photo (never AI-generated), shown with its credit */
  image?: { url: string; credit: string; creditUrl?: string; source: 'event' | 'google' | 'wikipedia' };
}

export interface LiveInfo {
  source: 'ticketmaster' | 'localist' | 'community' | 'google';
  sourceName: string;
  url: string;
  ticketUrl?: string;
  startsAt: string;
  endsAt?: string;
  endEstimated?: boolean;
  timeTBA?: boolean;
  openHours?: boolean;
  venue?: string;
  campus?: boolean;
  approxLocation?: boolean;
  area?: string;
  fetchedAt: string;
}

export interface LiveStatus {
  enabled: boolean;
  date: string | null;
  total: number;
  today?: number;
  sources: { id: string; name: string; ok: boolean | null; count: number; error?: string }[];
  upcoming?: { id: string; name: string; startsAt: string; source: string }[];
}

export interface Preferences {
  food: string[];
  event: string[];
  activity: string[];
}

export interface PublicUser {
  id: string;
  fullName: string;
  firstName: string;
  username: string;
  age: number;
  bio?: string;
  school?: string;
  avatarColor: string;
  preferences: Preferences;
  isDemo?: boolean;
}

export interface SelfUser extends PublicUser {
  email: string;
  tagWeights: Record<string, number>;
  wantIds: string[];
  lastPrice?: PriceTier;
  isGuest?: boolean;
  persona?: Persona;
  following?: string[];
}

export interface Me {
  user: SelfUser;
  stats: { completed: number; avgRating: number | null; posts: number; groups: number };
  bingo: { id: string; label: string; visited: boolean }[];
  tStops: TStopBingo;
  learnedFavorites: string[];
}

export interface RecFeedback {
  moreTags?: string[];
  cheaper?: boolean;
  closer?: boolean;
  different?: boolean;
}

export interface RecRequest {
  location: string;
  type: PlaceType;
  price: PriceTier;
  duration?: DurationId;
  /** How long you have, in minutes */
  durationMinutes?: number;
  /** When you're starting (ISO); omitted = now */
  startAt?: string;
  timeOfDay?: TimeOfDay;
  /** If nothing fits nearby, look anywhere reachable on the T */
  widen?: boolean;
  /** Where you're leaving from (device location, if you allow it) */
  from?: { lat: number; lng: number };
  groupMode?: boolean;
  groupId?: string;
  excludeIds?: string[];
  feedback?: RecFeedback;
}

export interface Suggestion {
  place: Place;
  score: number;
  reasons: string[];
  stretchNote?: string;
  widened?: boolean;
  travel?: { minutes: number; mode: 'walk' | 'T'; summary: string; fromYou: boolean };
  arriveAt?: string;
  openUntil?: string;
  opensAt?: string;
  hoursApprox?: boolean;
  communityRating?: { avg: number; count: number };
}

export interface RecResult {
  suggestions: Suggestion[];
  exhausted: boolean;
  widened?: boolean;
  budget: PriceTier;
}

export interface Group {
  id: string;
  name: string;
  memberIds: string[];
  status: 'forming' | 'active' | 'ended';
  originPlaceId: string;
  createdAt: string;
  members: PublicUser[];
  sharedInterests: { tag: string; who: string[]; whoIds: string[]; everyone: boolean }[];
  budget: PriceTier;
  activities: { placeId: string; byUserId: string; at: string; place: Place }[];
  origin: Place;
}

export interface Plan {
  id: string;
  userId: string;
  placeId: string;
  request: RecRequest;
  groupId?: string;
  status: 'active' | 'completed';
  startsAt?: string;
  endsAt?: string;
  rating?: number;
  review?: string;
  postId?: string;
  createdAt: string;
  completedAt?: string;
  place: Place;
  neighborhoodLabel: string;
  station?: { name: string; lat: number; lng: number; km: number } | null;
  hours?: { text: string; approx: boolean } | null;
  group: Group | null;
}

export interface FeedPost {
  id: string;
  rating: number;
  caption?: string;
  createdAt: string;
  user: PublicUser | null;
  place: Place;
  /** A whole day out, shared as one post */
  day?: { date: string; stops: DayStop[] } | null;
  group: { id: string; name: string; size: number } | null;
  likes: number;
  likedByMe: boolean;
  wantedByMe: boolean;
  mine: boolean;
  following?: boolean;
}

export interface ChatMessage {
  id: string;
  groupId: string;
  userId: string;
  text: string;
  at: string;
  user: PublicUser | null;
  mine: boolean;
}

export interface PersonProfile {
  user: PublicUser;
  me: boolean;
  following: boolean;
  followers: number;
  followingCount: number;
  posts: { id: string; rating: number; caption?: string; createdAt: string; place: Place; stops?: number }[];
  sharedCrews: { id: string; name: string }[];
}

export interface SavedItem {
  place: Place;
  planned: boolean;
}

export type TLine = 'red' | 'orange' | 'blue' | 'green' | 'silver';
export interface TStopBingo {
  stops: { name: string; lines: TLine[]; lat: number; lng: number; visited: boolean }[];
  routes: { line: TLine; stops: string[] }[];
  byLine: { line: TLine; label: string; visited: number; total: number }[];
  visited: number;
  total: number;
}

export interface DayStop {
  at: string;
  rating: number;
  place: Place;
}
export interface MyDay {
  date: string;
  stops: (DayStop & { planId: string; group: { id: string; name: string } | null })[];
  sharedPostId: string | null;
  caption: string;
}
