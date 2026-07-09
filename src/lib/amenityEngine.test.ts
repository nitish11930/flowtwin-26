import { describe, expect, test } from 'vitest';
import { findBestAmenity, parseAmenitySearchContext } from './amenityEngine';

describe('Amenity engine', () => {
  test('Finds low-crowd vegetarian food near Section 215', () => {
    const context = parseAmenitySearchContext('Where is the nearest vegetarian food stall near Section 215?');
    expect(context?.category).toBe('food');
    expect(context?.diet).toBe('vegetarian');
    expect(context?.origin).toBe('Section 215');

    const result = findBestAmenity(context!);
    expect(result?.amenity.name).toBe('FIFA Fresh Veg Kitchen');
    expect(result?.amenity.crowdLevel).toBe('Low');
    expect(result?.bookingAvailable).toBe(true);
  });

  test('Finds accessible restroom with less crowd', () => {
    const context = parseAmenitySearchContext('Where is the nearest bathroom with less crowd near Section 215?');
    expect(context?.category).toBe('restroom');
    expect(context?.avoidCrowds).toBe(true);

    const result = findBestAmenity(context!);
    expect(result?.amenity.name).toBe('Accessible Restroom R-215');
    expect(result?.amenity.accessible).toBe(true);
    expect(result?.amenity.crowdLevel).toBe('Low');
  });

  test('Finds Coca-Cola sponsor zone near Gate A', () => {
    const context = parseAmenitySearchContext('I want Coca-Cola sponsor stall near Gate A');
    expect(context?.category).toBe('sponsor');
    expect(context?.sponsor).toBe('Coca-Cola');

    const result = findBestAmenity(context!);
    expect(result?.amenity.name).toBe('Coca-Cola Fan Zone');
    expect(result?.amenity.sponsor).toBe('Coca-Cola');
  });
});
