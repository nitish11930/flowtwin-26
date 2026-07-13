'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  defaultSharedState,
  mergeSharedState,
  normalizeSharedState,
  type SharedState,
  type StadiumKnowledgeCategory,
  type StadiumKnowledgeEntry
} from './sharedStateCore';

const STORAGE_KEY = 'flowtwin-shared-state';

export type { SharedState, StadiumKnowledgeCategory, StadiumKnowledgeEntry } from './sharedStateCore';

function parseStoredState(value: string | null): SharedState {
  if (!value) return defaultSharedState;

  try {
    return normalizeSharedState(JSON.parse(value));
  } catch {
    return defaultSharedState;
  }
}

function shouldAcceptIncoming(incoming: SharedState, current: SharedState) {
  return (incoming.sharedUpdatedAt || 0) >= (current.sharedUpdatedAt || 0);
}

export function useSharedState() {
  const [state, setState] = useState<SharedState>(defaultSharedState);
  const stateRef = useRef<SharedState>(defaultSharedState);

  const applyState = useCallback((nextState: SharedState, persistLocal = true) => {
    const normalized = normalizeSharedState(nextState);
    stateRef.current = normalized;
    setState(normalized);

    if (persistLocal) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      window.dispatchEvent(new CustomEvent('local-storage-sync', { detail: normalized }));
    }
  }, []);

  const fetchServerState = useCallback(async () => {
    try {
      const response = await fetch('/api/shared-state', { cache: 'no-store' });
      if (!response.ok) return;

      const data = await response.json();
      const incoming = normalizeSharedState(data?.state);
      if (shouldAcceptIncoming(incoming, stateRef.current)) {
        applyState(incoming);
      }
    } catch {
      // Browser localStorage remains the offline/demo fallback.
    }
  }, [applyState]);

  useEffect(() => {
    const cached = parseStoredState(localStorage.getItem(STORAGE_KEY));
    applyState(cached, false);
    fetchServerState();

    const pollId = window.setInterval(fetchServerState, 5000);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        const incoming = parseStoredState(e.newValue);
        if (shouldAcceptIncoming(incoming, stateRef.current)) {
          applyState(incoming, false);
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.clearInterval(pollId);
      window.removeEventListener('storage', handleStorage);
    };
  }, [applyState, fetchServerState]);

  const setSharedState = (updates: Partial<SharedState>) => {
    const stampedUpdates = { ...updates, sharedUpdatedAt: Date.now() };
    const nextState = mergeSharedState(stateRef.current, stampedUpdates);
    applyState(nextState);

    fetch('/api/shared-state', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: stampedUpdates })
    })
      .then(async (response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!data?.state) return;
        const incoming = normalizeSharedState(data.state);
        if (shouldAcceptIncoming(incoming, stateRef.current)) {
          applyState(incoming);
        }
      })
      .catch(() => {
        // Keep the optimistic local state if server sync is unavailable.
      });
  };

  useEffect(() => {
    const handleLocalSync = (e: Event) => {
      const customEvent = e as CustomEvent<SharedState>;
      if (customEvent.detail) {
        const incoming = normalizeSharedState(customEvent.detail);
        if (shouldAcceptIncoming(incoming, stateRef.current)) {
          stateRef.current = incoming;
          setState(incoming);
        }
      }
    };
    window.addEventListener('local-storage-sync', handleLocalSync);
    return () => window.removeEventListener('local-storage-sync', handleLocalSync);
  }, []);

  return { state, setSharedState };
}
