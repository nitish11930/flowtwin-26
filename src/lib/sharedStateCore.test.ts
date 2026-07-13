import { describe, expect, test } from 'vitest';
import { mergeSharedState, normalizeSharedState } from './sharedStateCore';

describe('shared stadium state normalization', () => {
  test('keeps valid knowledge entries and removes malformed entries', () => {
    const state = normalizeSharedState({
      gateCSurgeActive: true,
      announcementDraft: ' Gate B is clear ',
      announcementSource: 'Ops',
      announcementUpdatedAt: 123,
      stadiumKnowledge: [
        {
          id: 'knowledge-1',
          category: 'transport',
          title: 'Metro delay',
          detail: 'Metro Line 1 is delayed by 15 minutes.',
          location: 'Metro Line 1',
          status: 'Delayed 15 min',
          updatedAt: 456
        },
        { title: 'Missing detail' }
      ]
    });

    expect(state.gateCSurgeActive).toBe(true);
    expect(state.announcementDraft).toBe('Gate B is clear');
    expect(state.stadiumKnowledge).toHaveLength(1);
    expect(state.stadiumKnowledge[0].title).toBe('Metro delay');
  });

  test('mergeSharedState stamps updates for server sync ordering', () => {
    const merged = mergeSharedState(
      { gateCSurgeActive: false, stadiumKnowledge: [], sharedUpdatedAt: 10 },
      { gateCSurgeActive: true }
    );

    expect(merged.gateCSurgeActive).toBe(true);
    expect(merged.sharedUpdatedAt).toBeGreaterThan(10);
  });
});
