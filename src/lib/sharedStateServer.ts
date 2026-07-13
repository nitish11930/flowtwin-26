import { defaultSharedState, mergeSharedState, normalizeSharedState, type SharedState } from './sharedStateCore';

const SHARED_STATE_KEY = 'flowtwin:shared-state:v1';

declare global {
  // eslint-disable-next-line no-var
  var flowtwinSharedStateMemory: SharedState | undefined;
}

type PersistenceMode = 'vercel_kv' | 'memory_fallback';

function getKvConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ''), token };
}

async function runKvCommand<T>(command: unknown[]): Promise<T | null> {
  const config = getKvConfig();
  if (!config) return null;

  const response = await fetch(`${config.url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify([command]),
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Shared state KV request failed with ${response.status}`);
  }

  const payload = await response.json();
  const result = Array.isArray(payload) ? payload[0] : null;
  if (result?.error) throw new Error(String(result.error));
  return result?.result ?? null;
}

function getMemoryState() {
  globalThis.flowtwinSharedStateMemory = normalizeSharedState(globalThis.flowtwinSharedStateMemory || defaultSharedState);
  return globalThis.flowtwinSharedStateMemory;
}

export function getSharedStatePersistenceMode(): PersistenceMode {
  return getKvConfig() ? 'vercel_kv' : 'memory_fallback';
}

export async function readSharedState(): Promise<SharedState> {
  if (getKvConfig()) {
    const raw = await runKvCommand<string>(['GET', SHARED_STATE_KEY]);
    if (!raw) return defaultSharedState;

    try {
      return normalizeSharedState(JSON.parse(raw));
    } catch {
      return defaultSharedState;
    }
  }

  return getMemoryState();
}

export async function writeSharedState(nextState: SharedState): Promise<SharedState> {
  const normalized = normalizeSharedState(nextState);

  if (getKvConfig()) {
    await runKvCommand<string>(['SET', SHARED_STATE_KEY, JSON.stringify(normalized)]);
    return normalized;
  }

  globalThis.flowtwinSharedStateMemory = normalized;
  return normalized;
}

export async function patchSharedState(updates: Partial<SharedState>): Promise<SharedState> {
  const current = await readSharedState();
  return writeSharedState(mergeSharedState(current, updates));
}
