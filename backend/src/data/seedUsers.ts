import type { Preferences, PriceTier } from '../types.js';

/**
 * Simulated Bostonians so a single person can demo group matching and the feed.
 * They're flagged `isDemo` in the database. In production these would be real users.
 */
export interface DemoLocal {
  id: string;
  fullName: string;
  username: string;
  age: number;
  school: string;
  bio: string;
  preferences: Preferences;
  /** Most they're comfortable spending on one outing */
  budget: PriceTier;
  /** What they say when a crew forms */
  hello: string;
}

export const DEMO_LOCALS: DemoLocal[] = [
  {
    id: 'demo-maya',
    fullName: 'Maya Chen',
    username: 'mayaonthegreenline',
    age: 21,
    school: 'Boston University',
    bio: 'BU junior from Allston. Always down for a show or dumplings.',
    preferences: { food: ['Chinese', 'Asian', 'Dessert'], event: ['Live music', 'Small events'], activity: ['Nature', 'Shopping'] },
    budget: '20to40',
    hello: "hiii! Maya here, BU junior. honestly just happy to be out of the library 😅",
  },
  {
    id: 'demo-jordan',
    fullName: 'Jordan Okafor',
    username: 'dotave_jordan',
    age: 24,
    school: 'Born & raised in Dorchester',
    bio: 'Townie. Nurse at MGH. Will defend the Celtics to the death.',
    preferences: { food: ['Seafood', 'Locally owned', 'Sit-down'], event: ['Sporting events', '50+ people'], activity: ['History', 'Nature'] },
    budget: '40plus',
    hello: "Jordan, lifelong Bostonian. Happy to show y'all where the locals actually go.",
  },
  {
    id: 'demo-priya',
    fullName: 'Priya Raman',
    username: 'priyaplays',
    age: 20,
    school: 'Northeastern',
    bio: 'NEU co-op kid, violin since age 6, museum nerd.',
    preferences: { food: ['Mediterranean', 'Fast casual', 'Dessert'], event: ['Orchestra', 'Performing arts'], activity: ['Museums', 'Arts & crafts'] },
    budget: '20to40',
    hello: 'Hey! Priya, Northeastern. First time doing something like this, excited!!',
  },
  {
    id: 'demo-diego',
    fullName: 'Diego Alvarez',
    username: 'diegobuilds',
    age: 23,
    school: 'MIT (grad)',
    bio: 'Grad student in Kendall. Board games, tacos, and long walks to anywhere but lab.',
    preferences: { food: ['Mexican', 'Fast casual', 'Locally owned'], event: ['Small events', 'Comedy'], activity: ['Games', 'Museums'] },
    budget: '20to40',
    hello: "Diego here, MIT grad student. I'll bring the competitive energy 🎲",
  },
  {
    id: 'demo-sam',
    fullName: 'Sam Whitaker',
    username: 'samdoescomedy',
    age: 22,
    school: 'Emerson',
    bio: 'Emerson senior. Improv, stand-up, and late-night slices.',
    preferences: { food: ['Italian', 'Walk-up window', 'Fast food'], event: ['Comedy', 'Performing arts', 'Parties'], activity: ['Games', 'Shopping'] },
    budget: '10to20',
    hello: 'Sam from Emerson 👋 if anyone wants a bit, I have twelve',
  },
  {
    id: 'demo-aisha',
    fullName: 'Aisha Bello',
    username: 'aishainunionsq',
    age: 25,
    school: 'Barista in Union Square',
    bio: 'Somerville barista + ceramicist. Ask me about the best donuts in Union Sq.',
    preferences: { food: ['Locally owned', 'Dessert', 'Mediterranean'], event: ['Small events', 'Live music'], activity: ['Arts & crafts', 'Shopping', 'Seasonal'] },
    budget: '20to40',
    hello: 'Aisha! I live in Somerville and know every good coffee spot. ask me anything ☕',
  },
  {
    id: 'demo-kevin',
    fullName: 'Kevin Tran',
    username: 'kev_crimson',
    age: 19,
    school: 'Harvard',
    bio: 'Harvard sophomore. Hockey fan, dim sum devotee.',
    preferences: { food: ['Chinese', 'Japanese', 'Asian'], event: ['College sports', 'Sporting events'], activity: ['Games', 'History'] },
    budget: '40plus',
    hello: 'yo! Kevin, Harvard soph. trying to see more of the city than just the Square lol',
  },
  {
    id: 'demo-lena',
    fullName: 'Lena Petrova',
    username: 'lenasails',
    age: 27,
    school: 'Product designer in the Seaport',
    bio: 'Designer, sailor, oyster enthusiast.',
    preferences: { food: ['Seafood', 'Fine dining', 'Mediterranean'], event: ['Live music', 'Orchestra'], activity: ['Nature', 'Museums'] },
    budget: '40plus',
    hello: "Lena, I work in the Seaport. so glad to meet people outside of work!",
  },
  {
    id: 'demo-marcus',
    fullName: 'Marcus Reid',
    username: 'marcus_bc',
    age: 22,
    school: 'Boston College',
    bio: 'BC senior in Brighton. Runner, Italian food loyalist.',
    preferences: { food: ['Italian', 'Sit-down', 'Fast food'], event: ['College sports', 'Sporting events', 'Parties'], activity: ['Nature', 'History'] },
    budget: '40plus',
    hello: "Marcus, BC '27. down for whatever, let's make it a day",
  },
  {
    id: 'demo-hana',
    fullName: 'Hana Suzuki',
    username: 'hana.berklee',
    age: 21,
    school: 'Berklee',
    bio: 'Berklee songwriter. Thrifting, ramen, and every open mic in town.',
    preferences: { food: ['Japanese', 'Asian', 'Fast casual'], event: ['Live music', 'Small events'], activity: ['Shopping', 'Arts & crafts'] },
    budget: '10to20',
    hello: "Hana from Berklee 🎶 love this, let's go!",
  },
  {
    id: 'demo-tom',
    fullName: "Tom O'Brien",
    username: 'tom_townie',
    age: 30,
    school: 'Charlestown local',
    bio: 'Charlestown born. Freedom Trail know-it-all. Red Sox season ticket dreamer.',
    preferences: { food: ['Seafood', 'Sit-down', 'Locally owned'], event: ['Sporting events', '50+ people'], activity: ['History', 'Nature'] },
    budget: '40plus',
    hello: 'Tom here, Charlestown townie. I know a ridiculous amount of Boston history, be warned',
  },
  {
    id: 'demo-sofia',
    fullName: 'Sofia Marquez',
    username: 'sofiaexplores',
    age: 20,
    school: 'Tufts',
    bio: 'Tufts sophomore. Museums, pastries, and seasonal everything.',
    preferences: { food: ['Dessert', 'Mexican', 'Italian'], event: ['Performing arts', 'Live music'], activity: ['Museums', 'Seasonal', 'Nature'] },
    budget: '20to40',
    hello: 'Sofia, Tufts! I take a ridiculous number of photos, hope that’s ok 📸',
  },
];

/** Starter posts so the public feed isn't empty on first run. */
export const SEED_POSTS: { userId: string; placeId: string; rating: number; caption: string; hoursAgo: number }[] = [
  { userId: 'demo-maya', placeId: 'gourmet-dumpling', rating: 5, caption: 'soup dumplings after a long week = therapy 🥟', hoursAgo: 2 },
  { userId: 'demo-tom', placeId: 'bunker-hill', rating: 4, caption: '294 steps. my calves are filing a complaint.', hoursAgo: 5 },
  { userId: 'demo-priya', placeId: 'nec', rating: 5, caption: 'FREE world-class chamber music?? NEC is criminally underrated', hoursAgo: 9 },
  { userId: 'demo-diego', placeId: 'pandemonium', rating: 5, caption: 'Met 3 new people at game night. Lost every game. 10/10', hoursAgo: 20 },
  { userId: 'demo-aisha', placeId: 'union-donuts', rating: 5, caption: 'brown butter hazelnut crunch remains undefeated', hoursAgo: 26 },
  { userId: 'demo-kevin', placeId: 'bu-hockey', rating: 4, caption: 'crossed enemy lines for hockey. the BU student section is unhinged (complimentary)', hoursAgo: 30 },
  { userId: 'demo-sofia', placeId: 'gardner', rating: 5, caption: 'the courtyard in late fall is unreal', hoursAgo: 46 },
  { userId: 'demo-sam', placeId: 'improv-asylum', rating: 4, caption: 'got pulled on stage. regret nothing.', hoursAgo: 52 },
  { userId: 'demo-lena', placeId: 'navy-yard-ferry', rating: 5, caption: 'a harbor cruise for the price of a T fare?? locals have been gatekeeping', hoursAgo: 70 },
];
