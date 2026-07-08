import routesData from '../data/routes.json';
import liveCrowdData from '../data/live-crowd-data.json';
import transportData from '../data/transport-status.json';

export type UserNeeds = {
  requiresAccessibility: boolean;
};

export type RouteData = {
  id: string;
  name: string;
  startPoint: string;
  endPoint: string;
  distanceMeters: number;
  isAccessible: boolean;
  hasStairs: boolean;
  averageTimeMins: number;
  transitId: string;
  sustainabilityBonus: number;
};

export type RouteScoreResult = {
  route: RouteData;
  score: number;
  explanation: string;
};

export function calculateBestRoute(userNeeds: UserNeeds, gateCSurgeActive: boolean = false): RouteScoreResult | null {
  const routes = routesData as RouteData[];
  if (!routes || routes.length === 0) return null;

  let bestRoute: RouteScoreResult | null = null;
  let lowestScore = Infinity;

  // Global weather penalty check (if any active warning exists)
  const weather_penalty = liveCrowdData.weatherAlerts.some(
    alert => alert.active && alert.severity === 'Warning'
  ) ? 50 : 0;

  for (const route of routes) {
    const distance = route.distanceMeters;

    // 1. Crowd Penalty
    // Calculate from the new live-crowd-data format.
    const congestionData = (liveCrowdData.congestion as any)[route.startPoint];
    let waitTime = congestionData ? congestionData.estimatedWaitTimeMins : 0;
    
    // Support the legacy surge override requested in the parameters
    if (gateCSurgeActive && route.startPoint === 'Gate C') {
      waitTime += 50; // massive artificial wait time to force reroute
    }
    
    const crowd_penalty = waitTime * 10; // multiplier to scale against distance

    // 2. Accessibility Penalty
    let accessibility_penalty = 0;
    if (userNeeds.requiresAccessibility && !route.isAccessible) {
      accessibility_penalty = 1000;
    }

    // 3. Transport Delay Penalty
    const transportService = transportData.services.find(s => s.id === route.transitId);
    const transport_delay_penalty = transportService ? transportService.delayMinutes * 10 : 0;

    // 4. Sustainability Bonus
    const sustainability_bonus = route.sustainabilityBonus;

    // EXACT FORMULA REQUIRED BY PHASE 2
    const score = distance + crowd_penalty + accessibility_penalty + weather_penalty + transport_delay_penalty - sustainability_bonus;

    if (score < lowestScore) {
      lowestScore = score;
      
      const explanation = `Selected ${route.name}. ` +
        (gateCSurgeActive && route.startPoint !== 'Gate C' ? 'Gate C is heavily congested, so we routed you to ' + route.startPoint + ' instead. ' : `Formula output score is ${score}. `) +
        (route.isAccessible ? 'This route is fully accessible.' : 'This route is NOT accessible.');

      bestRoute = { 
        route, 
        score,
        explanation
      };
    }
  }

  return bestRoute;
}
