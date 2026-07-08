import { expect, test, describe } from 'vitest';
import { calculateRouteScore, RouteData } from './routingEngine';
import mapData from '../data/stadium-map.json';

describe('routingEngine', () => {
  test('avoids Gate C when gateCSurgeActive is true', () => {
    // 1. Get a list of routes.
    const routes = mapData.routes as RouteData[];
    
    // 2. Calculate best route when surge is active.
    const userNeeds = { requiresAccessibility: false };
    const surgeResult = calculateRouteScore(routes, userNeeds, true);
    
    // 3. Ensure the best route does not use Gate C if there are other options.
    expect(surgeResult).toBeDefined();
    expect(surgeResult?.route.gate).not.toBe('Gate C');
  });

  test('may use Gate C when gateCSurgeActive is false', () => {
    const routes = mapData.routes as RouteData[];
    const userNeeds = { requiresAccessibility: false };
    const normalResult = calculateRouteScore(routes, userNeeds, false);
    
    // Without surge, Gate C might be chosen depending on distance/penalties.
    // In our map data, usually Gate C is the closest for some routes.
    expect(normalResult).toBeDefined();
  });
});
