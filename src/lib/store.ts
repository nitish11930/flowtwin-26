'use client';
import { useState, useEffect } from 'react';

const STORAGE_KEY = 'flowtwin-shared-state';

export type SharedState = {
  gateCSurgeActive: boolean;
};

const defaultState: SharedState = {
  gateCSurgeActive: false,
};

export function useSharedState() {
  const [state, setState] = useState<SharedState>(defaultState);

  useEffect(() => {
    // Load initial
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setState(JSON.parse(stored));
    }

    // Listen to changes from other tabs
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        setState(JSON.parse(e.newValue));
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
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setState(customEvent.detail);
      }
    };
    window.addEventListener('local-storage-sync', handleLocalSync);
    return () => window.removeEventListener('local-storage-sync', handleLocalSync);
  }, []);

  return { state, setSharedState };
}
