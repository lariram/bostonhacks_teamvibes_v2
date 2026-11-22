import type { DurationId, NeighborhoodId, PlaceType, PriceTier, TimeOfDay } from '../types.js';

export interface Neighborhood {
  id: NeighborhoodId;
  label: string;
  /** Neighborhoods a quick walk or a couple of T stops away */
  near: NeighborhoodId[];
}

export const NEIGHBORHOODS: Neighborhood[] = [
  { id: 'downtown', label: 'Downtown Boston', near: ['theater', 'chinatown', 'northend', 'backbay', 'seaport', 'charlestown'] },
  { id: 'theater', label: 'Theater District', near: ['downtown', 'chinatown', 'backbay'] },
  { id: 'allston', label: 'Allston', near: ['brighton', 'cambridge', 'fenway'] },
  { id: 'brighton', label: 'Brighton', near: ['allston'] },
  { id: 'somerville', label: 'Somerville', near: ['cambridge', 'charlestown'] },
  { id: 'chinatown', label: 'Chinatown', near: ['downtown', 'theater', 'seaport'] },
  { id: 'cambridge', label: 'Cambridge', near: ['somerville', 'allston', 'backbay'] },
  { id: 'seaport', label: 'Seaport', near: ['downtown', 'chinatown'] },
  { id: 'charlestown', label: 'Charlestown', near: ['northend', 'downtown', 'somerville'] },
  { id: 'northend', label: 'North End', near: ['downtown', 'charlestown'] },
  { id: 'backbay', label: 'Back Bay', near: ['downtown', 'theater', 'fenway', 'cambridge'] },
  { id: 'fenway', label: 'Fenway', near: ['backbay', 'allston'] },
];

export const NEIGHBORHOOD_BY_ID = Object.fromEntries(NEIGHBORHOODS.map((n) => [n.id, n])) as Record<
  NeighborhoodId,
  Neighborhood
>;

export const TYPES: { id: PlaceType; label: string }[] = [
  { id: 'event', label: 'Event' },
  { id: 'activity', label: 'Activity' },
  { id: 'food', label: 'Food' },
];

/** Ordered cheapest → priciest; the order is used as a budget cap. */
export const PRICE_TIERS: { id: PriceTier; label: string }[] = [
  { id: 'free', label: 'Free' },
  { id: 'under10', label: '< $10' },
  { id: '10to20', label: '$10 – $20' },
  { id: '20to40', label: '$20 – $40' },
  { id: '40plus', label: '$40 +' },
];

export const priceRank = (p: PriceTier) => PRICE_TIERS.findIndex((t) => t.id === p);
export const priceLabel = (p: PriceTier) => PRICE_TIERS[priceRank(p)]?.label ?? p;

export const DURATIONS: { id: DurationId; label: string; maxMinutes: number; targetMinutes: number }[] = [
  { id: 'quick', label: '< 1 hr', maxMinutes: 60, targetMinutes: 40 },
  { id: 'short', label: '1 – 2 hrs', maxMinutes: 120, targetMinutes: 90 },
  { id: 'half', label: '2 – 4 hrs', maxMinutes: 240, targetMinutes: 180 },
  { id: 'day', label: 'All day', maxMinutes: 600, targetMinutes: 300 },
];

export const TIMES_OF_DAY: { id: TimeOfDay; label: string }[] = [
  { id: 'morning', label: 'Morning' },
  { id: 'afternoon', label: 'Afternoon' },
  { id: 'evening', label: 'Evening' },
  { id: 'late', label: 'Late night' },
];

/** Map an hour (0-23) to a time-of-day bucket. */
export function timeOfDayForHour(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'late';
}

/** The interest tags shown during onboarding (pick up to 3 per category). */
export const PREFERENCE_TAGS: Record<PlaceType, string[]> = {
  food: [
    'Fast casual',
    'Locally owned',
    'Italian',
    'Seafood',
    'Fast food',
    'Chinese',
    'Walk-up window',
    'Japanese',
    'Fine dining',
    'Sit-down',
    'Greek',
    'Asian',
    'Mediterranean',
    'Mexican',
    'Dessert',
  ],
  event: [
    'Sporting events',
    'Live music',
    'Performing arts',
    'College sports',
    'Orchestra',
    'Comedy',
    'Parties',
    '50+ people',
    'Small events',
  ],
  activity: ['Arts & crafts', 'Nature', 'Games', 'History', 'Museums', 'Shopping', 'Seasonal'],
};

export const MAX_PREFS_PER_CATEGORY = 3;

export const AVATAR_COLORS = ['#DA291C', '#00843D', '#003DA5', '#80276C', '#008EAA', '#4A5257'];
