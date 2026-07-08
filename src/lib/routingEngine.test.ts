import { expect, test, describe } from 'vitest';
import { calculateBestRoute } from './routingEngine';

describe('routingEngine', () => {
  test('avoids Gate C when gateCSurgeActive is true', () => {
    // 1. Calculate best route when surge is active.
    const userNeeds = { requiresAccessibility: false };
    const surgeResult = calculateBestRoute(userNeeds, true);
    
    // 2. Ensure the best route does not use Gate C if there are other options.
    expect(surgeResult).toBeDefined();
    expect(surgeResult?.route.startPoint).not.toBe('Gate C');
  });

  test('may use Gate C when gateCSurgeActive is false', () => {
    const userNeeds = { requiresAccessibility: false };
    const normalResult = calculateBestRoute(userNeeds, false);
    
    // Without surge, Gate C might be chosen depending on distance/penalties.
    expect(normalResult).toBeDefined();
  });
});
