import amenitiesData from '../data/amenities.json';

export type AmenityCategory = 'food' | 'drink' | 'water' | 'restroom' | 'sponsor';

export type Amenity = {
  id: string;
  name: string;
  category: AmenityCategory;
  location: string;
  nearestSection: string;
  nearestGate: string;
  items: string[];
  dietary: string[];
  sponsor: string | null;
  queueTimeMins: number;
  crowdLevel: 'Low' | 'Moderate' | 'High' | 'Severe';
  accessible: boolean;
  acceptsPreOrder: boolean;
  distanceByOrigin: Record<string, number>;
};

export type AmenitySearchContext = {
  category?: AmenityCategory;
  origin?: string;
  diet?: string;
  sponsor?: string;
  requiresAccessibility?: boolean;
  avoidCrowds?: boolean;
  wantsPreOrder?: boolean;
  language?: 'en' | 'hi' | 'es' | 'fr' | 'pt' | 'ar';
};

export type AmenityRecommendation = {
  amenity: Amenity & {
    distanceMeters: number;
    walkingTimeMins: number;
  };
  alternative?: Amenity & {
    distanceMeters: number;
    walkingTimeMins: number;
  };
  score: number;
  routeSummary: string;
  reason: string;
  bookingAvailable: boolean;
};

const amenities = amenitiesData as Amenity[];

const CROWD_PENALTY: Record<Amenity['crowdLevel'], number> = {
  Low: 0,
  Moderate: 80,
  High: 220,
  Severe: 500
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function estimateDistance(amenity: Amenity, origin?: string) {
  if (!origin) return amenity.distanceByOrigin['Section 215'] ?? 300;
  const direct = amenity.distanceByOrigin[origin];
  if (typeof direct === 'number') return direct;

  const normalizedOrigin = normalize(origin);
  const matchingKey = Object.keys(amenity.distanceByOrigin).find(key => normalize(key) === normalizedOrigin);
  return matchingKey ? amenity.distanceByOrigin[matchingKey] : 300;
}

function walkingTime(distanceMeters: number) {
  return Math.max(1, Math.ceil(distanceMeters / 75));
}

function matchesCategory(amenity: Amenity, category?: AmenityCategory) {
  if (!category) return true;
  if (category === 'drink') return amenity.category === 'drink' || amenity.category === 'water';
  return amenity.category === category;
}

function matchesDiet(amenity: Amenity, diet?: string) {
  if (!diet) return true;
  const target = normalize(diet);
  return amenity.dietary.some(item => normalize(item).includes(target)) ||
    amenity.items.some(item => normalize(item).includes(target));
}

function matchesSponsor(amenity: Amenity, sponsor?: string) {
  if (!sponsor) return true;
  const target = normalize(sponsor);
  return normalize(amenity.sponsor ?? '').includes(target) ||
    normalize(amenity.name).includes(target) ||
    amenity.items.some(item => normalize(item).includes(target));
}

function scoreAmenity(amenity: Amenity, context: AmenitySearchContext) {
  const distance = estimateDistance(amenity, context.origin);
  const queuePenalty = amenity.queueTimeMins * 16;
  const crowdPenalty = context.avoidCrowds ? CROWD_PENALTY[amenity.crowdLevel] : CROWD_PENALTY[amenity.crowdLevel] / 3;
  const accessibilityPenalty = context.requiresAccessibility && !amenity.accessible ? 1000 : 0;
  const preorderBonus = context.wantsPreOrder && amenity.acceptsPreOrder ? 80 : 0;
  const exactSectionBonus = context.origin && amenity.nearestSection === context.origin ? 80 : 0;
  return distance + queuePenalty + crowdPenalty + accessibilityPenalty - preorderBonus - exactSectionBonus;
}

function hydrateAmenity(amenity: Amenity, origin?: string) {
  const distanceMeters = estimateDistance(amenity, origin);
  return {
    ...amenity,
    distanceMeters,
    walkingTimeMins: walkingTime(distanceMeters)
  };
}

export function findBestAmenity(context: AmenitySearchContext): AmenityRecommendation | null {
  const candidates = amenities
    .filter(amenity => matchesCategory(amenity, context.category))
    .filter(amenity => matchesDiet(amenity, context.diet))
    .filter(amenity => matchesSponsor(amenity, context.sponsor))
    .sort((a, b) => scoreAmenity(a, context) - scoreAmenity(b, context));

  if (candidates.length === 0) return null;

  const [best, second] = candidates;
  const score = Math.round(scoreAmenity(best, context));
  const hydratedBest = hydrateAmenity(best, context.origin);
  const hydratedAlternative = second ? hydrateAmenity(second, context.origin) : undefined;
  const routeSummary = `Walk from ${context.origin ?? 'your current area'} to ${hydratedBest.location}. Estimated ${hydratedBest.walkingTimeMins} min, ${hydratedBest.distanceMeters} m.`;
  const crowdReason = context.avoidCrowds
    ? `It avoids severe crowd pressure and has ${hydratedBest.crowdLevel.toLowerCase()} crowding.`
    : `Current queue is about ${hydratedBest.queueTimeMins} min with ${hydratedBest.crowdLevel.toLowerCase()} crowding.`;
  const accessibilityReason = hydratedBest.accessible ? 'Accessible route available.' : 'Accessibility is limited at this location.';

  return {
    amenity: hydratedBest,
    alternative: hydratedAlternative,
    score,
    routeSummary,
    reason: `${crowdReason} ${accessibilityReason}`,
    bookingAvailable: hydratedBest.acceptsPreOrder && (hydratedBest.category === 'food' || hydratedBest.category === 'drink')
  };
}

export function parseAmenitySearchContext(message: string): AmenitySearchContext | null {
  const lower = message.toLowerCase();
  const isFood = /\b(food|eat|meal|vegetarian|vegan|halal|snack|stall)\b/.test(lower);
  const isDrink = /\b(drink|coke|coca-cola|soda|beverage)\b/.test(lower);
  const isWater = /\b(water|hydration|refill)\b/.test(lower);
  const isRestroom = /\b(restroom|bathroom|toilet|washroom)\b/.test(lower);
  const isSponsor = /\b(sponsor|coca-cola|adidas|fifa store|merch|jersey|fan zone)\b/.test(lower);
  const explicitSponsor = /\b(sponsor|fan zone|kiosk|merch|jersey|fifa store|adidas)\b/.test(lower);

  if (!isFood && !isDrink && !isWater && !isRestroom && !isSponsor) {
    return null;
  }

  const sectionMatch = message.match(/\bsection\s*([a-z0-9]+)/i);
  const gateMatch = message.match(/\bgate\s*([a-z0-9]+)/i);
  const origin = sectionMatch
    ? `Section ${sectionMatch[1].toUpperCase()}`
    : gateMatch
      ? `Gate ${gateMatch[1].toUpperCase()}`
      : undefined;

  let category: AmenityCategory | undefined;
  if (explicitSponsor) category = 'sponsor';
  else if (isRestroom) category = 'restroom';
  else if (isWater) category = 'water';
  else if (isDrink) category = 'drink';
  else if (isSponsor && !isFood) category = 'sponsor';
  else if (isFood) category = 'food';

  let diet: string | undefined;
  if (lower.includes('vegetarian')) diet = 'vegetarian';
  if (lower.includes('vegan')) diet = 'vegan';
  if (lower.includes('halal')) diet = 'halal';

  let sponsor: string | undefined;
  if (lower.includes('coca-cola') || lower.includes('coke')) sponsor = 'Coca-Cola';
  if (lower.includes('adidas')) sponsor = 'Adidas';
  if (lower.includes('fifa store')) sponsor = 'FIFA Store';

  return {
    category,
    origin,
    diet,
    sponsor,
    requiresAccessibility: lower.includes('accessible') || lower.includes('wheelchair'),
    avoidCrowds: lower.includes('less crowd') || lower.includes('avoid crowd') || lower.includes('not crowded') || lower.includes('gate c'),
    wantsPreOrder: lower.includes('book') || lower.includes('booking') || lower.includes('reserve') || lower.includes('pre-order') || lower.includes('pickup'),
    language: lower.includes('hindi') ? 'hi' : 'en'
  };
}

export function buildAmenityAnswer(recommendation: AmenityRecommendation, context: AmenitySearchContext) {
  const { amenity } = recommendation;
  const items = amenity.items.slice(0, 3).join(', ');
  const preorder = recommendation.bookingAvailable ? ' You can reserve pickup from this stall.' : '';
  const base = `${amenity.name} is the best match at ${amenity.location}. It has ${amenity.crowdLevel.toLowerCase()} crowding, about ${amenity.queueTimeMins} min queue, and is ${amenity.walkingTimeMins} min away. Available: ${items}.${preorder} ${recommendation.reason}`;

  if (context.language === 'hi') {
    return `Hindi सहायता: ${amenity.name} सबसे अच्छा विकल्प है, location ${amenity.location}. Queue लगभग ${amenity.queueTimeMins} min है और walk ${amenity.walkingTimeMins} min. Available: ${items}.`;
  }

  return base;
}
