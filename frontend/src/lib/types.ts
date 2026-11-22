// Mirrors backend/src/types.ts (kept separate so the two apps stay independent)

export type PlaceType = 'event' | 'activity' | 'food';
export type PriceTier = 'free' | 'under10' | '10to20' | '20to40' | '40plus';
export type DurationId = 'quick' | 'short' | 'half' | 'day';
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'late';

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
}

export interface Me {
  user: SelfUser;
  stats: { completed: number; avgRating: number | null; posts: number; groups: number };
  bingo: { id: string; label: string; visited: boolean }[];
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
  duration: DurationId;
  timeOfDay?: TimeOfDay;
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
  communityRating?: { avg: number; count: number };
}

export interface RecResult {
  suggestions: Suggestion[];
  exhausted: boolean;
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
  rating?: number;
  review?: string;
  postId?: string;
  createdAt: string;
  completedAt?: string;
  place: Place;
  neighborhoodLabel: string;
  group: Group | null;
}

export interface FeedPost {
  id: string;
  rating: number;
  caption?: string;
  createdAt: string;
  user: PublicUser | null;
  place: Place;
  group: { id: string; name: string; size: number } | null;
  likes: number;
  likedByMe: boolean;
  wantedByMe: boolean;
  mine: boolean;
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
