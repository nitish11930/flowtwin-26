export type IncidentStatus = 'open' | 'assigned' | 'team_notified' | 'in_progress' | 'resolved';

export type IncidentTimelineEvent = {
  label: string;
  status: IncidentStatus;
  timestamp: string;
  note?: string;
};

export type Incident = {
  id: string;
  type: 'lost_child' | 'medical' | 'accessibility' | 'crowd' | 'security' | 'maintenance';
  sector: string;
  location: string;
  description: string;
  severity: 'low' | 'amber' | 'red' | 'high';
  status: IncidentStatus;
  assignedTo?: string;
  securityNotified?: boolean;
  teamNotified?: boolean;
  medicalTeamNotified?: boolean;
  dispatchNotified?: boolean;
  missingDetails?: Record<string, string>;
  notes?: string[];
  timeline?: IncidentTimelineEvent[];
  createdAt: string;
  updatedAt?: string;
};

export type IncidentUpdate = {
  status?: IncidentStatus;
  assignedTo?: string;
  securityNotified?: boolean;
  teamNotified?: boolean;
  medicalTeamNotified?: boolean;
  dispatchNotified?: boolean;
  missingDetails?: Record<string, string>;
  notes?: string | string[];
  timeline?: IncidentTimelineEvent[];
};

type IncidentDraft = Omit<Incident, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'timeline'> & {
  status?: IncidentStatus;
  timeline?: IncidentTimelineEvent[];
};

export type IncidentWriteResult = Incident & { deduped?: boolean };

const VALID_STATUSES: IncidentStatus[] = ['open', 'assigned', 'team_notified', 'in_progress', 'resolved'];
const SEVERITY_SCORE: Record<Incident['severity'], number> = {
  low: 1,
  amber: 2,
  high: 3,
  red: 4
};

function createTimelineEvent(status: IncidentStatus, label: string, note?: string): IncidentTimelineEvent {
  return {
    status,
    label,
    note,
    timestamp: new Date().toISOString()
  };
}

function statusLabel(status: IncidentStatus) {
  const labels: Record<IncidentStatus, string> = {
    open: 'Reported',
    assigned: 'Assigned',
    team_notified: 'Response team notified',
    in_progress: 'Response in progress',
    resolved: 'Resolved'
  };
  return labels[status];
}

function normalizeComparable(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function isIncidentStatus(value: unknown): value is IncidentStatus {
  return VALID_STATUSES.includes(value as IncidentStatus);
}

function normalizeIncidentDescription(incident: Incident) {
  const description = incident.description.trim();

  if (incident.type === 'medical' && /^auto-created incident for:\s*medical$/i.test(description)) {
    return 'Medical emergency reported via Policy Assistant | Exact location missing | Symptoms missing | Consciousness status missing | Breathing status missing';
  }

  if (incident.type === 'lost_child' && /^auto-created incident for:\s*lost_child$/i.test(description)) {
    return 'Lost child reported via Policy Assistant | Child details pending secure intake';
  }

  return incident.description;
}

export type Task = {
  id: string;
  title: string;
  description: string;
  sector: string;
  timeframe: string;
  isComplete: boolean;
};

export type FoodOrder = {
  id: string;
  amenityId: string;
  amenityName: string;
  pickupLocation: string;
  items: string[];
  status: 'reserved' | 'ready' | 'picked_up';
  pickupEtaMins: number;
  createdAt: string;
};

export type FoodOrderDraft = {
  amenityId: string;
  amenityName: string;
  pickupLocation: string;
  items: string[];
  pickupEtaMins?: number;
};

export class DataStore {
  incidents: Incident[] = [];
  orders: FoodOrder[] = [];
  tasks: Task[] = [
    {
      id: 't1',
      title: 'Assist at Gate B Accessible Entry',
      description: 'Help fans at Gate B',
      sector: 'Gate B',
      timeframe: '14:00 - 16:00',
      isComplete: false
    },
    {
      id: 't2',
      title: 'Stock Water Stations',
      description: 'Ensure hydration stations are full',
      sector: 'Concourse 1',
      timeframe: '13:00 - 14:00',
      isComplete: true
    }
  ];

  createFoodOrder(order: FoodOrderDraft): FoodOrder {
    const newOrder: FoodOrder = {
      id: `ord-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      amenityId: order.amenityId,
      amenityName: order.amenityName,
      pickupLocation: order.pickupLocation,
      items: order.items,
      status: 'reserved',
      pickupEtaMins: order.pickupEtaMins ?? 10,
      createdAt: new Date().toISOString()
    };
    this.orders.unshift(newOrder);
    return newOrder;
  }

  getFoodOrders(): FoodOrder[] {
    return this.orders;
  }

  addIncident(incident: IncidentDraft): IncidentWriteResult {
    const duplicate = this.findOpenDuplicate(incident);

    if (duplicate) {
      this.mergeDuplicateIncident(duplicate, incident);
      return { ...duplicate, deduped: true };
    }

    const newIncident: Incident = {
      ...incident,
      id: `inc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: isIncidentStatus(incident.status) ? incident.status : 'open',
      securityNotified: incident.securityNotified ?? false,
      teamNotified: incident.teamNotified ?? false,
      medicalTeamNotified: incident.medicalTeamNotified ?? false,
      dispatchNotified: incident.dispatchNotified ?? false,
      notes: incident.notes ?? [],
      createdAt: new Date().toISOString(),
      timeline: incident.timeline ?? [createTimelineEvent('open', 'Incident reported')]
    };
    this.incidents.unshift(newIncident);
    return newIncident;
  }

  getIncidents(): Incident[] {
    this.incidents = this.incidents.map(incident => this.normalizeIncident(incident));
    return this.incidents;
  }

  updateIncident(id: string, update: IncidentStatus | IncidentUpdate): Incident | null {
    const incident = this.incidents.find(i => i.id === id);
    if (incident) {
      this.normalizeIncident(incident);
      const patch = typeof update === 'string' ? { status: update } : update;
      const previousStatus = incident.status;
      const wasAssigned = Boolean(incident.assignedTo);
      const wasSecurityNotified = Boolean(incident.securityNotified);
      const wasMedicalTeamNotified = Boolean(incident.medicalTeamNotified);
      const wasDispatchNotified = Boolean(incident.dispatchNotified);

      if (isIncidentStatus(patch.status)) incident.status = patch.status;
      if (patch.assignedTo !== undefined) incident.assignedTo = patch.assignedTo;
      if (patch.securityNotified !== undefined) incident.securityNotified = patch.securityNotified;
      if (patch.teamNotified !== undefined) incident.teamNotified = patch.teamNotified;
      if (patch.medicalTeamNotified !== undefined) incident.medicalTeamNotified = patch.medicalTeamNotified;
      if (patch.dispatchNotified !== undefined) incident.dispatchNotified = patch.dispatchNotified;
      if (patch.missingDetails) {
        incident.missingDetails = {
          ...(incident.missingDetails ?? {}),
          ...patch.missingDetails
        };
      }
      if (patch.notes) {
        const newNotes = Array.isArray(patch.notes) ? patch.notes : [patch.notes];
        incident.notes = [...(incident.notes ?? []), ...newNotes.filter(Boolean)];
      }

      if (patch.timeline) {
        incident.timeline = [...(incident.timeline ?? []), ...patch.timeline];
      }

      if (incident.securityNotified || incident.medicalTeamNotified) {
        incident.teamNotified = true;
      }

      if (patch.assignedTo && !wasAssigned) {
        incident.timeline = [
          ...(incident.timeline ?? []),
          createTimelineEvent('assigned', 'Assigned to response owner', patch.assignedTo)
        ];
      }

      if (incident.securityNotified && !wasSecurityNotified) {
        incident.timeline = [
          ...(incident.timeline ?? []),
          createTimelineEvent('team_notified', 'Security notified')
        ];
      }

      if (incident.medicalTeamNotified && !wasMedicalTeamNotified) {
        incident.timeline = [
          ...(incident.timeline ?? []),
          createTimelineEvent('team_notified', 'Medical team notified')
        ];
      }

      if (incident.dispatchNotified && !wasDispatchNotified) {
        incident.timeline = [
          ...(incident.timeline ?? []),
          createTimelineEvent('in_progress', 'EMS dispatch started')
        ];
      }

      if (incident.status !== previousStatus) {
        incident.timeline = [
          ...(incident.timeline ?? []),
          createTimelineEvent(incident.status, statusLabel(incident.status))
        ];
      }

      incident.updatedAt = new Date().toISOString();
      return incident;
    }
    return null;
  }

  private findOpenDuplicate(incident: IncidentDraft): Incident | undefined {
    const sector = normalizeComparable(incident.sector);
    const location = normalizeComparable(incident.location);

    return this.incidents
      .map(existingIncident => this.normalizeIncident(existingIncident))
      .find(existingIncident => (
        existingIncident.type === incident.type &&
        existingIncident.status !== 'resolved' &&
        normalizeComparable(existingIncident.sector) === sector &&
        normalizeComparable(existingIncident.location) === location
      ));
  }

  private mergeDuplicateIncident(existing: Incident, incoming: IncidentDraft) {
    this.normalizeIncident(existing);

    if (SEVERITY_SCORE[incoming.severity] > SEVERITY_SCORE[existing.severity]) {
      existing.severity = incoming.severity;
    }

    if (
      incoming.description &&
      incoming.description !== existing.description &&
      (existing.description.startsWith('Auto-created incident') || incoming.description.length > existing.description.length)
    ) {
      existing.description = incoming.description;
    }

    existing.assignedTo = incoming.assignedTo ?? existing.assignedTo;
    existing.securityNotified = incoming.securityNotified ?? existing.securityNotified;
    existing.teamNotified = incoming.teamNotified ?? existing.teamNotified;
    existing.medicalTeamNotified = incoming.medicalTeamNotified ?? existing.medicalTeamNotified;
    existing.dispatchNotified = incoming.dispatchNotified ?? existing.dispatchNotified;
    existing.missingDetails = {
      ...(existing.missingDetails ?? {}),
      ...(incoming.missingDetails ?? {})
    };
    existing.notes = [
      ...(existing.notes ?? []),
      'Duplicate report merged into this open incident.'
    ];
    existing.timeline = [
      ...(existing.timeline ?? []),
      createTimelineEvent(existing.status, 'Duplicate report merged')
    ];
    existing.updatedAt = new Date().toISOString();
  }

  private normalizeIncident(incident: Incident): Incident {
    const rawStatus = incident.status as unknown;

    if (typeof rawStatus === 'object' && rawStatus !== null) {
      const patch = rawStatus as IncidentUpdate;

      if (isIncidentStatus(patch.status)) incident.status = patch.status;
      if (patch.assignedTo !== undefined) incident.assignedTo = patch.assignedTo;
      if (patch.securityNotified !== undefined) incident.securityNotified = patch.securityNotified;
      if (patch.missingDetails) {
        incident.missingDetails = {
          ...(incident.missingDetails ?? {}),
          ...patch.missingDetails
        };
      }
      if (patch.notes) {
        const newNotes = Array.isArray(patch.notes) ? patch.notes : [patch.notes];
        incident.notes = [...(incident.notes ?? []), ...newNotes.filter(Boolean)];
      }
    }

    if (!isIncidentStatus(incident.status)) {
      incident.status = 'open';
    }

    incident.notes = Array.isArray(incident.notes)
      ? incident.notes.filter(note => typeof note === 'string')
      : [];
    incident.description = normalizeIncidentDescription(incident);
    incident.securityNotified = Boolean(incident.securityNotified);
    incident.medicalTeamNotified = Boolean(incident.medicalTeamNotified);
    incident.dispatchNotified = Boolean(incident.dispatchNotified);
    incident.teamNotified = Boolean(incident.teamNotified || incident.securityNotified || incident.medicalTeamNotified);
    incident.timeline = Array.isArray(incident.timeline)
      ? incident.timeline.filter(event => event && typeof event.label === 'string' && typeof event.timestamp === 'string')
      : [];
    if (incident.timeline.length === 0) {
      incident.timeline = [{
        label: 'Incident reported',
        status: 'open',
        timestamp: incident.createdAt
      }];
    }
    return incident;
  }

  completeTask(id: string): Task | null {
    const task = this.tasks.find(t => t.id === id);
    if (task) {
      task.isComplete = true;
      return task;
    }
    return null;
  }
}

// Global instance to persist in memory during dev
const globalForStore = global as unknown as { store?: unknown };
const existingStore = globalForStore.store;
export const store = existingStore instanceof DataStore ? existingStore : new DataStore();

if (existingStore && !(existingStore instanceof DataStore)) {
  const previousStore = existingStore as Partial<DataStore>;
  store.incidents = Array.isArray(previousStore.incidents) ? previousStore.incidents : [];
  store.tasks = Array.isArray(previousStore.tasks) ? previousStore.tasks : store.tasks;
  store.orders = Array.isArray(previousStore.orders) ? previousStore.orders : [];
}

if (process.env.NODE_ENV !== 'production') globalForStore.store = store;
