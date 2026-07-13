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

export type SharedState = {
  gateCSurgeActive: boolean;
  announcementDraft?: string;
  announcementSource?: string;
  announcementUpdatedAt?: number;
  sharedUpdatedAt?: number;
  stadiumKnowledge: StadiumKnowledgeEntry[];
};

export const defaultSharedState: SharedState = {
  gateCSurgeActive: false,
  stadiumKnowledge: [],
};

const categories = new Set<StadiumKnowledgeCategory>([
  'transport',
  'accessibility',
  'security',
  'policy',
  'amenity',
  'operations',
  'sustainability'
]);

function optionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function optionalNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizeKnowledgeEntry(entry: unknown): StadiumKnowledgeEntry | null {
  if (!entry || typeof entry !== 'object') return null;

  const candidate = entry as Record<string, unknown>;
  const title = optionalString(candidate.title);
  const detail = optionalString(candidate.detail);
  if (!title || !detail) return null;

  const rawCategory = candidate.category;
  const category = typeof rawCategory === 'string' && categories.has(rawCategory as StadiumKnowledgeCategory)
    ? rawCategory as StadiumKnowledgeCategory
    : 'operations';

  return {
    id: optionalString(candidate.id) || `knowledge-${Date.now()}`,
    category,
    title,
    detail,
    location: optionalString(candidate.location),
    status: optionalString(candidate.status),
    updatedAt: optionalNumber(candidate.updatedAt) || Date.now()
  };
}

export function normalizeSharedState(value: unknown): SharedState {
  const candidate = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const entries = Array.isArray(candidate.stadiumKnowledge)
    ? candidate.stadiumKnowledge.map(normalizeKnowledgeEntry).filter((entry): entry is StadiumKnowledgeEntry => Boolean(entry)).slice(0, 30)
    : [];

  return {
    ...defaultSharedState,
    gateCSurgeActive: typeof candidate.gateCSurgeActive === 'boolean' ? candidate.gateCSurgeActive : defaultSharedState.gateCSurgeActive,
    announcementDraft: optionalString(candidate.announcementDraft),
    announcementSource: optionalString(candidate.announcementSource),
    announcementUpdatedAt: optionalNumber(candidate.announcementUpdatedAt),
    sharedUpdatedAt: optionalNumber(candidate.sharedUpdatedAt),
    stadiumKnowledge: entries
  };
}

export function mergeSharedState(base: SharedState, updates: Partial<SharedState>): SharedState {
  return normalizeSharedState({
    ...base,
    ...updates,
    sharedUpdatedAt: updates.sharedUpdatedAt || Date.now()
  });
}
