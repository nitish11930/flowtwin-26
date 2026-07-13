'use client';
import { useState, useEffect } from 'react';

const STORAGE_KEY = 'flowtwin-shared-state';

export type SharedState = {
  gateCSurgeActive: boolean;
  announcementDraft?: string;
  announcementSource?: string;
  announcementUpdatedAt?: number;
  stadiumKnowledge: StadiumKnowledgeEntry[];
};

export type StadiumKnowledgeCategory = 'transport' | 'accessibility' | 'security' | 'policy' | 'amenity' | 'operations' | 'sustainability';

export type StadiumKnowledgeEntry = {
  id: string;
  category: StadiumKnowledgeCategory;
  title: string;
  detail: string;
  location?: string;
  status?: string;
  updatedAt: number;
};

const defaultState: SharedState = {
  gateCSurgeActive: false,
  stadiumKnowledge: [],
};

function parseStoredState(value: string | null): SharedState {
  if (!value) return defaultState;

  try {
    const parsed = JSON.parse(value);
    return {
      ...defaultState,
      ...parsed,
      stadiumKnowledge: Array.isArray(parsed?.stadiumKnowledge) ? parsed.stadiumKnowledge : []
    };
  } catch {
    return defaultState;
  }
}

export function useSharedState() {
  const [state, setState] = useState<SharedState>(defaultState);

  useEffect(() => {
    setState(parseStoredState(localStorage.getItem(STORAGE_KEY)));

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setState(parseStoredState(e.newValue));
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const setSharedState = (updates: Partial<SharedState>) => {
    const newState = { ...state, ...updates };
    setState(newState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    window.dispatchEvent(new CustomEvent('local-storage-sync', { detail: newState }));
  };

  useEffect(() => {
    const handleLocalSync = (e: Event) => {
      const customEvent = e as CustomEvent<SharedState>;
      if (customEvent.detail) {
        setState({ ...defaultState, ...customEvent.detail });
      }
    };
    window.addEventListener('local-storage-sync', handleLocalSync);
    return () => window.removeEventListener('local-storage-sync', handleLocalSync);
  }, []);

  return { state, setSharedState };
}
