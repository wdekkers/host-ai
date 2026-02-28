import type { CreateDraftInput, QueueItem } from '@walt/contracts';

type DraftEventType =
  | 'draft.created'
  | 'draft.edited'
  | 'draft.approved'
  | 'draft.sent'
  | 'incident.created'
  | 'incident.transitioned';

type DraftEvent = {
  type: DraftEventType;
  timestamp: string;
  payload: Record<string, unknown>;
};

type IncidentState = 'active' | 'negotiation' | 'resolution-accepted' | 'recovery-closed' | 'normalized';

type Incident = {
  id: string;
  summary: string;
  state: IncidentState;
  createdAt: string;
  updatedAt: string;
};

type OperationalAwareness = {
  pendingCount: number;
  approvedCount: number;
  sentCount: number;
  lastEventType: DraftEventType | null;
};

type PropertyType = 'STR' | 'MTR';

type RolloutProperty = {
  propertyId: string;
  name: string;
  type: PropertyType;
};

type HostOnboarding = {
  hostId: string;
  status: 'onboarded';
  onboardedAt: string;
};

type RolloutState = {
  internalOnly: boolean;
  internalValidationComplete: boolean;
  properties: RolloutProperty[];
  onboardedHosts: HostOnboarding[];
  targetHostCount: number;
  progressPercent: number;
  phase: 'internal-validation' | 'gradual-onboarding' | 'ready-to-scale';
};

type TrainingSignal = {
  draftId: string;
  intent: string;
  before: string;
  after: string;
  capturedAt: string;
};

type RoiMetrics = {
  messagesHandled: number;
  incidentCount: number;
  totalRefundAmount: number;
  reviewAverage: number;
};

type AuditAction = QueueItem['auditLog'][number]['action'];

type AuditTimelineEntry = {
  draftId: string;
  reservationId: string;
  intent: string;
  action: AuditAction;
  actorId: string;
  timestamp: string;
};

type AuditTimelineFilters = {
  draftId?: string;
  actorId?: string;
  action?: AuditAction;
  since?: string;
  until?: string;
};

type RiskRecommendationInput = {
  globalTrustScore: number;
  localRiskTolerance: number;
  localIncidentSignals: number;
};

type RiskRecommendation = {
  decision: 'accept' | 'review' | 'decline';
  reasons: string[];
};

type StrategyRecommendationInput = {
  localSeverity: number;
  portfolioTrend: 'low-risk' | 'high-risk';
  portfolioConfidence: number;
};

type StrategyRecommendation = {
  action: 'escalate-now' | 'monitor-tightly' | 'routine-handle';
  primaryDriver: 'local' | 'portfolio';
  note: string;
};

type Store = {
  listQueue: () => QueueItem[];
  createDraft: (input: CreateDraftInput) => QueueItem;
  editDraft: (id: string, body: string) => QueueItem;
  approveDraft: (id: string, actorId: string) => QueueItem;
  sendDraft: (id: string, actorId: string) => QueueItem;
  listEvents: () => DraftEvent[];
  getOperationalAwareness: () => OperationalAwareness;
  createIncident: (summary: string) => Incident;
  transitionIncident: (id: string, next: IncidentState) => Incident;
  listIncidents: () => Incident[];
  getRolloutState: () => RolloutState;
  completeInternalValidation: () => RolloutState;
  onboardHost: (hostId: string) => HostOnboarding;
  listTrainingSignals: () => TrainingSignal[];
  listAuditTimeline: (filters?: AuditTimelineFilters) => AuditTimelineEntry[];
  recordRefund: (amount: number) => RoiMetrics;
  recordGuestReview: (rating: number) => RoiMetrics;
  getRoiMetrics: () => RoiMetrics;
};

type StoreOptions = {
  seed?: QueueItem[];
  policiesByIntent?: Record<string, string>;
};

let idCounter = 0;
let incidentCounter = 0;

const nextId = () => {
  idCounter += 1;
  return `draft-${idCounter}`;
};

const nextIncidentId = () => {
  incidentCounter += 1;
  return `incident-${incidentCounter}`;
};

const nowIso = () => new Date().toISOString();

const defaultPoliciesByIntent: Record<string, string> = {
  'check-in-reminder': 'Check-in starts at 4:00 PM. Early check-in requires host approval.',
  'first-morning-check': 'Send first-morning check before 9:00 AM local time.'
};

const buildDraftBody = (input: CreateDraftInput, policyText: string) => {
  const guest = typeof input.context.guestName === 'string' ? input.context.guestName : 'there';
  return `Hi ${guest}, this is your ${input.intent.replace(/-/g, ' ')} update. ${policyText}`;
};

const buildSources = (input: CreateDraftInput, policyText: string) => [
  {
    type: 'policy' as const,
    label: `${input.intent} policy`,
    snippet: policyText
  },
  {
    type: 'reservation' as const,
    label: `Reservation ${input.reservationId}`,
    snippet: JSON.stringify(input.context)
  }
];

const makeSeedItem = (): QueueItem => {
  const ts = nowIso();
  return {
    id: nextId(),
    reservationId: 'seed-001',
    intent: 'check-in-reminder',
    body: 'Hi Morgan, check-in starts at 4:00 PM. Message us anytime for help.',
    status: 'pending',
    createdAt: ts,
    updatedAt: ts,
    sources: [
      {
        type: 'policy',
        label: 'Check-in policy',
        snippet: 'Check-in is available after 4:00 PM.'
      }
    ],
    auditLog: [
      {
        action: 'created',
        actorId: 'system',
        timestamp: ts
      }
    ]
  };
};

const transitionMap: Record<IncidentState, IncidentState[]> = {
  active: ['negotiation'],
  negotiation: ['resolution-accepted'],
  'resolution-accepted': ['recovery-closed'],
  'recovery-closed': ['normalized'],
  normalized: []
};

const internalRolloutProperties: RolloutProperty[] = [
  { propertyId: 'prop-str-001', name: 'Oak Garden STR', type: 'STR' },
  { propertyId: 'prop-str-002', name: 'Ridge View STR', type: 'STR' },
  { propertyId: 'prop-str-003', name: 'Cedar Point STR', type: 'STR' },
  { propertyId: 'prop-mtr-001', name: 'Harbor MTR', type: 'MTR' }
];

export const createStore = (options: StoreOptions = {}): Store => {
  const queue = [...(options.seed ?? [makeSeedItem()])];
  const events: DraftEvent[] = [];
  const incidents: Incident[] = [];
  const trainingSignals: TrainingSignal[] = [];
  const policiesByIntent = { ...defaultPoliciesByIntent, ...(options.policiesByIntent ?? {}) };
  let internalValidationComplete = false;
  const onboardedHosts: HostOnboarding[] = [];
  const targetHostCount = 10;
  let totalRefundAmount = 0;
  const guestReviews: number[] = [];

  const emit = (type: DraftEventType, payload: Record<string, unknown>) => {
    events.push({ type, payload, timestamp: nowIso() });
  };

  const getRoi = (): RoiMetrics => ({
    messagesHandled: queue.filter((entry) => entry.status === 'sent').length,
    incidentCount: incidents.length,
    totalRefundAmount,
    reviewAverage:
      guestReviews.length > 0
        ? guestReviews.reduce((total, score) => total + score, 0) / guestReviews.length
        : 0
  });

  const getRollout = (): RolloutState => {
    const progressPercent = Math.min(100, Math.round((onboardedHosts.length / targetHostCount) * 100));
    const phase: RolloutState['phase'] =
      progressPercent >= 100
        ? 'ready-to-scale'
        : internalValidationComplete
          ? 'gradual-onboarding'
          : 'internal-validation';

    return {
      internalOnly: true,
      internalValidationComplete,
      properties: [...internalRolloutProperties],
      onboardedHosts: [...onboardedHosts],
      targetHostCount,
      progressPercent,
      phase
    };
  };

  const byId = (id: string) => {
    const item = queue.find((entry) => entry.id === id);
    if (!item) {
      throw new Error(`Draft not found: ${id}`);
    }
    return item;
  };

  const byIncidentId = (id: string) => {
    const incident = incidents.find((entry) => entry.id === id);
    if (!incident) {
      throw new Error(`Incident not found: ${id}`);
    }
    return incident;
  };

  return {
    listQueue: () => [...queue].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),

    createDraft: (input) => {
      const policyText = policiesByIntent[input.intent];
      if (!policyText) {
        throw new Error(`Missing policy context for intent: ${input.intent}`);
      }

      const ts = nowIso();
      const item: QueueItem = {
        id: nextId(),
        reservationId: input.reservationId,
        intent: input.intent,
        body: buildDraftBody(input, policyText),
        status: 'pending',
        createdAt: ts,
        updatedAt: ts,
        sources: buildSources(input, policyText),
        auditLog: [
          {
            action: 'created',
            actorId: 'system',
            timestamp: ts
          }
        ]
      };
      queue.unshift(item);
      emit('draft.created', { id: item.id, intent: item.intent });
      return item;
    },

    editDraft: (id, body) => {
      const item = byId(id);
      const ts = nowIso();
      const before = item.body;
      item.body = body;
      item.status = 'edited';
      item.updatedAt = ts;
      item.auditLog.push({ action: 'edited', actorId: 'host-user', timestamp: ts });
      trainingSignals.push({
        draftId: item.id,
        intent: item.intent,
        before,
        after: body,
        capturedAt: ts
      });
      emit('draft.edited', { id: item.id });
      return item;
    },

    approveDraft: (id, actorId) => {
      const item = byId(id);
      const ts = nowIso();
      item.status = 'approved';
      item.updatedAt = ts;
      item.auditLog.push({ action: 'approved', actorId, timestamp: ts });
      emit('draft.approved', { id: item.id, actorId });
      return item;
    },

    sendDraft: (id, actorId) => {
      const item = byId(id);
      if (item.status !== 'approved') {
        throw new Error('Draft must be approved before sending.');
      }
      const ts = nowIso();
      item.status = 'sent';
      item.updatedAt = ts;
      item.auditLog.push({ action: 'sent', actorId, timestamp: ts });
      emit('draft.sent', { id: item.id, actorId });
      return item;
    },

    listEvents: () => [...events],

    getOperationalAwareness: () => ({
      pendingCount: queue.filter((entry) => entry.status === 'pending' || entry.status === 'edited').length,
      approvedCount: queue.filter((entry) => entry.status === 'approved').length,
      sentCount: queue.filter((entry) => entry.status === 'sent').length,
      lastEventType: events.length > 0 ? events[events.length - 1]?.type ?? null : null
    }),

    createIncident: (summary) => {
      const ts = nowIso();
      const incident: Incident = {
        id: nextIncidentId(),
        summary,
        state: 'active',
        createdAt: ts,
        updatedAt: ts
      };
      incidents.push(incident);
      emit('incident.created', { incidentId: incident.id, summary });
      return incident;
    },

    transitionIncident: (id, next) => {
      const incident = byIncidentId(id);
      const allowed = transitionMap[incident.state];
      if (!allowed.includes(next)) {
        throw new Error(`Invalid transition: ${incident.state} -> ${next}`);
      }
      incident.state = next;
      incident.updatedAt = nowIso();
      emit('incident.transitioned', { incidentId: id, next });
      return incident;
    },

    listIncidents: () => [...incidents],

    getRolloutState: () => getRollout(),

    completeInternalValidation: () => {
      internalValidationComplete = true;
      return getRollout();
    },

    onboardHost: (hostId) => {
      if (!internalValidationComplete) {
        throw new Error('Internal validation is required before host onboarding.');
      }

      const existing = onboardedHosts.find((entry) => entry.hostId === hostId);
      if (existing) {
        return existing;
      }

      const record: HostOnboarding = {
        hostId,
        status: 'onboarded',
        onboardedAt: nowIso()
      };
      onboardedHosts.push(record);
      return record;
    },

    listTrainingSignals: () => [...trainingSignals],

    listAuditTimeline: (filters = {}) =>
      queue
        .flatMap((item) =>
          item.auditLog.map((entry) => ({
            draftId: item.id,
            reservationId: item.reservationId,
            intent: item.intent,
            action: entry.action,
            actorId: entry.actorId,
            timestamp: entry.timestamp
          }))
        )
        .filter((entry) => !filters.draftId || entry.draftId === filters.draftId)
        .filter((entry) => !filters.actorId || entry.actorId === filters.actorId)
        .filter((entry) => !filters.action || entry.action === filters.action)
        .filter((entry) => !filters.since || entry.timestamp >= filters.since)
        .filter((entry) => !filters.until || entry.timestamp <= filters.until)
        .sort((left, right) => right.timestamp.localeCompare(left.timestamp)),

    recordRefund: (amount) => {
      if (amount < 0) {
        throw new Error('Refund amount must be non-negative.');
      }
      totalRefundAmount += amount;
      return getRoi();
    },

    recordGuestReview: (rating) => {
      if (rating < 1 || rating > 5) {
        throw new Error('Guest review rating must be between 1 and 5.');
      }
      guestReviews.push(rating);
      return getRoi();
    },

    getRoiMetrics: () => getRoi()
  };
};

const singletonStore = createStore();

export const listQueue = () => singletonStore.listQueue();

export const createDraft = (store: Store, input: CreateDraftInput) => store.createDraft(input);
export const editDraft = (store: Store, id: string, body: string) => store.editDraft(id, body);
export const approveDraft = (store: Store, id: string, actorId: string) => store.approveDraft(id, actorId);
export const sendDraft = (store: Store, id: string, actorId: string) => store.sendDraft(id, actorId);

export const listEvents = (store: Store) => store.listEvents();
export const getOperationalAwareness = (store: Store) => store.getOperationalAwareness();
export const createIncident = (store: Store, summary: string) => store.createIncident(summary);
export const transitionIncident = (store: Store, id: string, next: IncidentState) =>
  store.transitionIncident(id, next);
export const listIncidents = (store: Store) => store.listIncidents();
export const getRolloutState = (store: Store) => store.getRolloutState();
export const completeInternalValidation = (store: Store) => store.completeInternalValidation();
export const onboardHost = (store: Store, hostId: string) => store.onboardHost(hostId);
export const listTrainingSignals = (store: Store) => store.listTrainingSignals();
export const listAuditTimeline = (store: Store, filters?: AuditTimelineFilters) => store.listAuditTimeline(filters);
export const recordRefund = (store: Store, amount: number) => store.recordRefund(amount);
export const recordGuestReview = (store: Store, rating: number) => store.recordGuestReview(rating);
export const getRoiMetrics = (store: Store) => store.getRoiMetrics();

export const getRiskRecommendation = (input: RiskRecommendationInput): RiskRecommendation => {
  const baseRisk = 100 - input.globalTrustScore;
  const localPenalty = (100 - input.localRiskTolerance) * 0.2 + input.localIncidentSignals * 20;
  const total = baseRisk + localPenalty;

  if (total >= 90) {
    return {
      decision: 'decline',
      reasons: ['Local incident pressure is high for this property.', 'Global trust is insufficient for auto-accept.']
    };
  }

  if (total >= 50) {
    return {
      decision: 'review',
      reasons: ['Recommendation requires host review due to mixed trust and local risk.']
    };
  }

  return {
    decision: 'accept',
    reasons: ['Global trust and local property risk are within acceptable range.']
  };
};

export const getStrategyRecommendation = (
  input: StrategyRecommendationInput
): StrategyRecommendation => {
  if (input.localSeverity >= 70) {
    return {
      action: 'escalate-now',
      primaryDriver: 'local',
      note: 'Local context dominates this decision despite portfolio trend.'
    };
  }

  if (input.portfolioTrend === 'high-risk' && input.portfolioConfidence >= 70) {
    return {
      action: 'monitor-tightly',
      primaryDriver: 'portfolio',
      note: 'Portfolio trend suggests elevated caution.'
    };
  }

  return {
    action: 'routine-handle',
    primaryDriver: 'local',
    note: 'No severe local issue and no strong adverse portfolio trend.'
  };
};

export const createDraftInSingleton = (input: CreateDraftInput) => singletonStore.createDraft(input);
export const editDraftInSingleton = (id: string, body: string) => singletonStore.editDraft(id, body);
export const approveDraftInSingleton = (id: string, actorId: string) => singletonStore.approveDraft(id, actorId);
export const sendDraftInSingleton = (id: string, actorId: string) => singletonStore.sendDraft(id, actorId);
export const listEventsInSingleton = () => singletonStore.listEvents();
export const getOperationalAwarenessInSingleton = () => singletonStore.getOperationalAwareness();
export const createIncidentInSingleton = (summary: string) => singletonStore.createIncident(summary);
export const transitionIncidentInSingleton = (id: string, next: IncidentState) =>
  singletonStore.transitionIncident(id, next);
export const listIncidentsInSingleton = () => singletonStore.listIncidents();
export const getRolloutStateInSingleton = () => singletonStore.getRolloutState();
export const completeInternalValidationInSingleton = () => singletonStore.completeInternalValidation();
export const onboardHostInSingleton = (hostId: string) => singletonStore.onboardHost(hostId);
export const listTrainingSignalsInSingleton = () => singletonStore.listTrainingSignals();
export const listAuditTimelineInSingleton = (filters?: AuditTimelineFilters) => singletonStore.listAuditTimeline(filters);
export const recordRefundInSingleton = (amount: number) => singletonStore.recordRefund(amount);
export const recordGuestReviewInSingleton = (rating: number) => singletonStore.recordGuestReview(rating);
export const getRoiMetricsInSingleton = () => singletonStore.getRoiMetrics();
