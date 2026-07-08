import mapData from '../data/stadium-map.json';

export type UserNeeds = {
  requiresAccessibility: boolean;
};

export type RouteData = {
  id: string;
  name: string;
  distance: number;
  gate: keyof typeof mapData.gates;
  transit: keyof typeof mapData.transit;
  isAccessible: boolean;
  weatherPenalty: number;
  sustainabilityBonus: number;
};

export type RouteResult = {
  route: RouteData;
  score: number;
};

export function calculateRouteScore(routes: RouteData[], userNeeds: UserNeeds, gateCSurgeActive: boolean = false): RouteResult | null {
  if (!routes || routes.length === 0) return null;

  let bestRoute: RouteResult | null = null;
  let lowestScore = Infinity;

  for (const route of routes) {
    const distance = route.distance;
    
    // Dynamic surge penalty
    let crowdPenalty = mapData.gates[route.gate].crowdPenalty;
    if (gateCSurgeActive && route.gate === 'Gate C') {
      crowdPenalty += 500; // massive penalty blocks this route
    }

    const transitDelay = mapData.transit[route.transit].transitPenalty;
    
    let accessibilityPenalty = 0;
    if (userNeeds.requiresAccessibility && !route.isAccessible) {
      accessibilityPenalty = 1000;
    }

    const weatherPenalty = route.weatherPenalty;
    const sustainabilityBonus = route.sustainabilityBonus;

    const score = distance + crowdPenalty + accessibilityPenalty + weatherPenalty + transitDelay - sustainabilityBonus;

    if (score < lowestScore) {
      lowestScore = score;
      bestRoute = { route, score };
    }
  }

  return bestRoute;
}

export type RouteScoreResult = {
  path: string[];
  score: number;
  explanation: string;
};

export function calculateBestRoute(startId: string, endId: string, needsAccessibility: boolean, gateCSurgeActive: boolean = false): RouteScoreResult {
  const best = calculateRouteScore(mapData.routes as RouteData[], { requiresAccessibility: needsAccessibility }, gateCSurgeActive);
  
  if (!best) {
    return { path: [startId, endId], score: 0, explanation: "No route found." };
  }
  
  return {
    path: [best.route.transit, best.route.gate, "Stadium Sector"],
    score: best.score,
    explanation: `Selected ${best.route.name}. ${gateCSurgeActive && best.route.gate !== 'Gate C' ? 'Gate C is heavily congested, so we routed you to ' + best.route.gate + ' instead.' : 'Formula output score is ' + best.score + '.'} ${best.route.isAccessible ? 'This route is fully accessible.' : 'This route is NOT accessible.'}`
  };
}
