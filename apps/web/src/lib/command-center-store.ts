import type { CreateDraftInput, QueueItem } from '@walt/contracts';

type DraftEventType =
  | 'draft.created'
  | 'draft.edited'
  | 'draft.approved'
  | 'draft.sent'
  | 'draft.rejected'
  | 'message.ingested'
  | 'incident.created'
  | 'incident.transitioned';

type DraftEvent = {
  type: DraftEventType;
  timestamp: string;
  payload: Record<string, unknown>;
};

type EventRecord = DraftEvent & {
  sequence: number;
  aggregateType: 'draft' | 'incident' | 'integration';
  aggregateId: string;
  actorId: string;
};

type OutboxDestination = 'audit-log' | 'projection-updater' | 'notifications';
type OutboxStatus = 'pending' | 'retrying' | 'delivered' | 'failed';

type OutboxRecord = {
  id: string;
  eventSequence: number;
  destination: OutboxDestination;
  status: OutboxStatus;
  attempts: number;
  payload: Record<string, unknown>;
  lastError?: string;
  nextAttemptAt?: string;
  createdAt: string;
  updatedAt: string;
};

type ApprovalQueueProjection = {
  kind: 'approval-queue';
  generatedAt: string;
  total: number;
  items: Array<{
    draftId: string;
    reservationId: string;
    intent: string;
    status: QueueItem['status'];
    updatedAt: string;
    priority: 'critical' | 'high' | 'normal';
  }>;
};

type PropertyStateProjection = {
  kind: 'property-state';
  generatedAt: string;
  total: number;
  items: PropertyStateSnapshot[];
};

type NormalizedProperty = {
  propertyId: string;
  reservationCount: number;
  messageCount: number;
  activeIncidentCount: number;
  lastActivityAt: string;
};

type NormalizedGuest = {
  guestId: string;
  guestName: string;
  reservationIds: string[];
  messageCount: number;
  lastMessageAt: string;
};

type NormalizedReservation = {
  reservationId: string;
  propertyId: string;
  guestName: string;
  draftCount: number;
  lastIntent: string;
  status: QueueItem['status'];
  updatedAt: string;
};

type NormalizedMessage = {
  messageId: string;
  reservationId: string;
  guestName: string;
  direction: 'inbound' | 'outbound';
  body: string;
  intent: string;
  createdAt: string;
};

type IncidentState = 'active' | 'negotiation' | 'resolution-accepted' | 'recovery-closed' | 'normalized';

type Incident = {
  id: string;
  summary: string;
  state: IncidentState;
  createdAt: string;
  updatedAt: string;
};

type IncidentTimelineEntry = {
  incidentId: string;
  state: IncidentState;
  actorId: string;
  timestamp: string;
  note: string;
};

type CleanerJitStatus = 'requested' | 'READY' | 'ETA' | 'NOT_READY';

type CleanerJitPing = {
  id: string;
  reservationId: string;
  cleanerId: string;
  reason: string;
  status: CleanerJitStatus;
  note?: string;
  etaMinutes?: number;
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
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
};

type AuditTimelineFilters = {
  draftId?: string;
  actorId?: string;
  action?: AuditAction;
  since?: string;
  until?: string;
};

type HospitableMessageInput = {
  eventId: string;
  reservationId: string;
  guestName: string;
  message: string;
  sentAt?: string;
};

type AssembledContext = {
  draftId: string;
  reservationId: string;
  intent: string;
  guestName: string;
  policy: string;
  knowledgeSources: QueueItem['sources'];
  reviewRequired: boolean;
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

type ExperienceRiskInput = {
  fixImpact: number;
  guestSensitivity: number;
  nightsRemaining: number;
};

type ExperienceRiskAssessment = {
  score: number;
  communicationUrgency: 'routine' | 'same-day' | 'immediate';
  compensationGuidance: 'no-credit' | 'consider-credit' | 'escalate-review';
  rationale: string[];
};

type TodayPriority = {
  draftId: string;
  reservationId: string;
  intent: string;
  status: QueueItem['status'];
  risk: 'low' | 'medium' | 'high';
  trust: 'low' | 'medium' | 'high';
  reason: string;
  priority: 'critical' | 'high' | 'normal';
  recommendedAction: 'review-now' | 'approve-or-edit' | 'send-now';
  createdAt: string;
  updatedAt: string;
};

type ProactiveSuggestion = {
  kind: 'check-in' | 'first-morning' | 'checkout' | 'heads-up';
  draftId: string;
  reservationId: string;
  intent: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
  suggestedMessage: string;
};

type IncidentAlertDraft = {
  incidentId: string;
  incidentState: IncidentState;
  hostAlert: string;
  guestDraft: string;
  urgency: 'immediate' | 'high' | 'normal';
  guestChannel: 'in-app-message';
  hostChannel: 'command-center-alert';
  updatedAt: string;
};

type PortfolioTrend = {
  incidentTrend: 'improving' | 'stable' | 'degrading';
  refundTrend: 'improving' | 'stable' | 'degrading';
  amenityReliability: 'high' | 'medium' | 'low';
  reviewQualityTrend: 'improving' | 'stable' | 'degrading';
  generatedAt: string;
};

type OperatingProfile = {
  strictness: number;
  generosity: number;
  compensationCapUsd: number;
  economicSensitivity: number;
  propertyRiskTolerance: Record<string, number>;
  updatedAt: string;
};

type RiskTrustAssessment = {
  riskScore: number;
  trustScore: number;
  recommendation: 'approve-with-guardrails' | 'manual-review' | 'decline';
  factors: {
    bookingPatternSignals: number;
    profileQualitySignals: number;
    languageCues: number;
    policyViolationFlags: number;
    positiveReviewHistory: number;
    responseQuality: number;
    explicitRuleAcceptance: number;
    strictness: number;
    generosity: number;
    compensationCapUsd: number;
    economicSensitivity: number;
  };
  rationale: string[];
};

type PropertyBrainProfile = {
  propertyId: string;
  coreRules: {
    checkInTime?: string;
    checkOutTime?: string;
    maxOccupancy?: number;
    quietHours?: string;
    houseRules: string[];
  };
  earlyLatePolicy: {
    earlyCheckIn?: { earliestTime: string; latestTime: string; priceTiers: Array<{ fromHour: number; toHour: number; amountUsd: number }> };
    lateCheckout?: { earliestTime: string; latestTime: string; priceTiers: Array<{ fromHour: number; toHour: number; amountUsd: number }> };
  };
  arrivalGuide: {
    entryMethod?: string;
    lockInstructions?: string;
    parkingInstructions?: string;
    accessNotes?: string;
  };
  cleanerPreferences: {
    channel?: 'sms' | 'whatsapp' | 'call';
    contact?: string;
    requiredFormat?: string;
    escalationAfterMinutes?: number;
  };
  amenityPolicies: {
    poolHeating?: { available: boolean; temperatureRangeF?: string; leadTimeHours?: number; caveats: string[] };
    hotTub?: { available: boolean; maxOccupancy?: number; safetyNotes: string[] };
    sauna?: { available: boolean; safetyNotes: string[] };
  };
  amenityImportanceIndex: Record<string, 'critical' | 'important' | 'enhancer'>;
  voiceProfile: {
    tone?: 'warm' | 'neutral' | 'formal';
    emojiUse?: 'none' | 'light' | 'friendly';
    strictness?: 'strict' | 'balanced' | 'flexible';
    apologyStyle?: 'brief' | 'empathetic' | 'formal';
  };
  escalationMatrix: {
    alwaysManualScenarios: string[];
    escalationChannel?: string;
  };
  auditLog: Array<{
    action: 'profile.updated';
    actorId: string;
    timestamp: string;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  }>;
  updatedAt: string;
};

type PropertyBrainCompleteness = {
  coreRules: boolean;
  earlyLatePolicy: boolean;
  arrivalGuide: boolean;
  cleanerPreferences: boolean;
  amenityPolicies: boolean;
  voiceProfile: boolean;
  escalationMatrix: boolean;
};

type PropertyBrainResolution = {
  response: string;
  requiresClarification: boolean;
  missingFields: string[];
  sources: Array<{ section: string; confidence: 'high' | 'medium' | 'low' }>;
  incidentPriority?: 'critical' | 'important' | 'enhancer';
  styleApplied?: { tone: 'warm' | 'neutral' | 'formal'; emojiUse: 'none' | 'light' | 'friendly' };
  manualOnly?: boolean;
  escalation?: { required: boolean; channel?: string };
};

type MessagingIntentV1 =
  | 'booking-inquiry'
  | 'rules-acknowledgment'
  | 'arrival-checkin'
  | 'checkout-guidance'
  | 'pool-help'
  | 'early-check-in-request'
  | 'late-checkout-request'
  | 'spa-help'
  | 'sauna-help'
  | 'refund-request'
  | 'threat'
  | 'injury'
  | 'accusation';

type IntentDraftResult = {
  mode: 'draft-only';
  manualOnly: boolean;
  requiresClarification: boolean;
  missingFields: string[];
  templateSections: string[];
  item: QueueItem;
};

type PropertyBrainProfileUpdateInput = {
  coreRules?: {
    checkInTime?: string;
    checkOutTime?: string;
    maxOccupancy?: number;
    quietHours?: string;
    houseRules?: string[];
  };
  earlyLatePolicy?: {
    earlyCheckIn?: { earliestTime: string; latestTime: string; priceTiers: Array<{ fromHour: number; toHour: number; amountUsd: number }> };
    lateCheckout?: { earliestTime: string; latestTime: string; priceTiers: Array<{ fromHour: number; toHour: number; amountUsd: number }> };
  };
  arrivalGuide?: {
    entryMethod?: string;
    lockInstructions?: string;
    parkingInstructions?: string;
    accessNotes?: string;
  };
  cleanerPreferences?: {
    channel?: 'sms' | 'whatsapp' | 'call';
    contact?: string;
    requiredFormat?: string;
    escalationAfterMinutes?: number;
  };
  amenityPolicies?: {
    poolHeating?: { available: boolean; temperatureRangeF?: string; leadTimeHours?: number; caveats: string[] };
    hotTub?: { available: boolean; maxOccupancy?: number; safetyNotes: string[] };
    sauna?: { available: boolean; safetyNotes: string[] };
  };
  amenityImportanceIndex?: Record<string, 'critical' | 'important' | 'enhancer'>;
  voiceProfile?: {
    tone?: 'warm' | 'neutral' | 'formal';
    emojiUse?: 'none' | 'light' | 'friendly';
    strictness?: 'strict' | 'balanced' | 'flexible';
    apologyStyle?: 'brief' | 'empathetic' | 'formal';
  };
  escalationMatrix?: {
    alwaysManualScenarios?: string[];
    escalationChannel?: string;
  };
};

type AutopilotAction = {
  id: string;
  reservationId: string;
  propertyId: string;
  intent: string;
  decision: 'auto-allowed' | 'manual-required';
  status: 'executed' | 'manual' | 'rolled_back';
  reason: string;
  rollbackReason?: string;
  createdAt: string;
  updatedAt: string;
};

type MonitoringCategory = 'upcoming-check-in' | 'missing-confirmation' | 'vendor-window' | 'amenity-issue';
type MonitoringSeverity = 'low' | 'medium' | 'high';
type MonitoringStatus = 'open' | 'acknowledged' | 'resolved';

type MonitoringAlert = {
  id: string;
  propertyId: string;
  reservationId?: string;
  category: MonitoringCategory;
  severity: MonitoringSeverity;
  status: MonitoringStatus;
  summary: string;
  detectedAt: string;
  updatedAt: string;
};

type PropertyReadiness = 'ready' | 'at-risk' | 'blocked';

type PropertyStateSnapshot = {
  propertyId: string;
  readiness: PropertyReadiness;
  blockers: string[];
  signals: {
    openAlerts: number;
    highSeverityAlerts: number;
    pendingCleanerPings: number;
    vendorConflicts: number;
    maintenanceIssues: number;
    criticalAmenityIssues: number;
  };
  updatedAt: string;
};

type JitCheckResult = {
  result: 'clear' | 'review' | 'block';
  checks: Array<{
    check: 'cleaner-readiness' | 'property-readiness' | 'overlap-risk';
    status: 'ok' | 'warning' | 'failed';
    detail: string;
  }>;
};

type MonitoringAgentStatus = {
  alwaysOn: boolean;
  lastRunAt: string;
  monitoredConditions: string[];
};

type IncidentResponsePlan = {
  hostAlert: string;
  guestDraft: {
    body: string;
    requiresApproval: true;
    channel: 'in-app-message';
  };
  compensationRecommendation: {
    amountUsd: number;
    rationale: string;
  };
};

type Store = {
  listQueue: () => QueueItem[];
  createDraft: (input: CreateDraftInput) => QueueItem;
  editDraft: (id: string, body: string, actorId?: string) => QueueItem;
  approveDraft: (id: string, actorId: string) => QueueItem;
  sendDraft: (id: string, actorId: string) => QueueItem;
  rejectDraft: (id: string, actorId: string) => QueueItem;
  listEvents: () => DraftEvent[];
  listEventRecords: (filters?: { type?: DraftEventType; actorId?: string; limit?: number }) => EventRecord[];
  listOutboxRecords: (filters?: { destination?: OutboxDestination; status?: OutboxStatus; limit?: number }) => OutboxRecord[];
  retryOutboxByDestination: (input: { destination: OutboxDestination; limit?: number }) => OutboxRecord[];
  getApprovalQueueProjection: (limit?: number) => ApprovalQueueProjection;
  getPropertyStateProjection: (limit?: number) => PropertyStateProjection;
  getNormalizedEntities: (kind?: 'properties' | 'guests' | 'reservations' | 'messages' | 'all') => {
    properties: NormalizedProperty[];
    guests: NormalizedGuest[];
    reservations: NormalizedReservation[];
    messages: NormalizedMessage[];
  };
  getOperationalAwareness: () => OperationalAwareness;
  createIncident: (summary: string) => Incident;
  transitionIncident: (id: string, next: IncidentState) => Incident;
  listIncidents: () => Incident[];
  listCleanerJitPings: (reservationId?: string) => CleanerJitPing[];
  createCleanerJitPing: (input: { reservationId: string; cleanerId: string; reason: string }) => CleanerJitPing;
  updateCleanerJitPing: (
    id: string,
    input: { status: Exclude<CleanerJitStatus, 'requested'>; note?: string; etaMinutes?: number }
  ) => CleanerJitPing;
  getRolloutState: () => RolloutState;
  completeInternalValidation: () => RolloutState;
  onboardHost: (hostId: string) => HostOnboarding;
  listTrainingSignals: () => TrainingSignal[];
  listAuditTimeline: (filters?: AuditTimelineFilters) => AuditTimelineEntry[];
  ingestHospitableMessage: (
    input: HospitableMessageInput
  ) => {
    item: QueueItem;
    duplicated: boolean;
  };
  assembleContextByDraftId: (draftId: string) => AssembledContext;
  regenerateDraftFromInbound: (draftId: string) => QueueItem;
  recordRefund: (amount: number) => RoiMetrics;
  recordGuestReview: (rating: number) => RoiMetrics;
  getRoiMetrics: () => RoiMetrics;
  getTodayPriorities: (limit?: number) => TodayPriority[];
  getProactiveSuggestions: (limit?: number) => ProactiveSuggestion[];
  listIncidentAlertDrafts: () => IncidentAlertDraft[];
  getPortfolioTrend: () => PortfolioTrend;
  getOperatingProfile: () => OperatingProfile;
  updateOperatingProfile: (input: {
    strictness?: number;
    generosity?: number;
    compensationCapUsd?: number;
    economicSensitivity?: number;
    propertyRiskTolerance?: Record<string, number>;
  }) => OperatingProfile;
  assessRiskTrustIntelligence: (input: {
    propertyId: string;
    bookingPatternSignals: number;
    profileQualitySignals: number;
    languageCues: number;
    policyViolationFlags: number;
    positiveReviewHistory: number;
    responseQuality: number;
    explicitRuleAcceptance: number;
  }) => RiskTrustAssessment;
  evaluateAutopilotAction: (input: { reservationId: string; intent: string; body: string }) => AutopilotAction;
  rollbackAutopilotAction: (input: { actionId: string; reason: string }) => AutopilotAction;
  listAutopilotActions: () => AutopilotAction[];
  runMonitoringAgents: () => MonitoringAlert[];
  listMonitoringAlerts: (filters?: {
    propertyId?: string;
    reservationId?: string;
    status?: MonitoringStatus;
    severity?: MonitoringSeverity;
    category?: MonitoringCategory;
    limit?: number;
  }) => MonitoringAlert[];
  getMonitoringAgentStatus: () => MonitoringAgentStatus;
  runJitChecks: (input: { reservationId: string; requestType: 'early-check-in' | 'late-checkout' }) => JitCheckResult;
  getIncidentResponsePlan: (incidentId: string) => IncidentResponsePlan;
  getIncidentTimeline: (incidentId: string) => IncidentTimelineEntry[];
  getPropertyState: (propertyId: string) => PropertyStateSnapshot;
  getPropertyBrainProfile: (propertyId: string) => PropertyBrainProfile;
  updatePropertyBrainProfile: (
    propertyId: string,
    input: PropertyBrainProfileUpdateInput,
    actorId: string
  ) => PropertyBrainProfile;
  getPropertyBrainCompleteness: (propertyId: string) => PropertyBrainCompleteness;
  resolvePropertyPolicy: (input: {
    propertyId: string;
    intent: string;
    amenity?: 'poolHeating' | 'hotTub' | 'sauna' | 'wifi' | 'bbq';
  }) => PropertyBrainResolution;
  getIntentTaxonomy: () => MessagingIntentV1[];
  createIntentDraft: (input: {
    propertyId: string;
    reservationId: string;
    intent: MessagingIntentV1;
    guestName: string;
    actorId?: string;
  }) => IntentDraftResult;
};

type StoreOptions = {
  seed?: QueueItem[];
  policiesByIntent?: Record<string, string>;
};

let idCounter = 0;
let incidentCounter = 0;
let cleanerPingCounter = 0;
let monitoringAlertCounter = 0;
let autopilotActionCounter = 0;
let outboxCounter = 0;

const nextId = () => {
  idCounter += 1;
  return `draft-${idCounter}`;
};

const nextIncidentId = () => {
  incidentCounter += 1;
  return `incident-${incidentCounter}`;
};

const nextCleanerPingId = () => {
  cleanerPingCounter += 1;
  return `cleaner-ping-${cleanerPingCounter}`;
};

const nextMonitoringAlertId = () => {
  monitoringAlertCounter += 1;
  return `monitor-alert-${monitoringAlertCounter}`;
};

const nextAutopilotActionId = () => {
  autopilotActionCounter += 1;
  return `autopilot-action-${autopilotActionCounter}`;
};

const nextOutboxId = () => {
  outboxCounter += 1;
  return `outbox-${outboxCounter}`;
};

const nowIso = () => new Date().toISOString();
const propertyIdFromReservation = (reservationId: string) => `property:${reservationId}`;
const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const defaultPoliciesByIntent: Record<string, string> = {
  'check-in-reminder': 'Check-in starts at 4:00 PM. Early check-in requires host approval.',
  'first-morning-check': 'Send first-morning check before 9:00 AM local time.',
  'early-check-in-request': 'Early check-in before 4:00 PM is based on readiness and may require a fee.',
  'late-checkout-request': 'Late checkout requests must be approved in advance based on turnover constraints.',
  'arrival-checkin': 'Arrival messages should include check-in time, access method, and parking instructions.',
  'checkout-guidance': 'Checkout messages should include checkout time and departure checklist.',
  'wifi-help': 'Wi-Fi details are shared after booking confirmation and should not include private credentials.',
  'parking-help': 'Parking instructions depend on property and local restrictions; share only validated instructions.',
  'booking-inquiry': 'Booking inquiries should confirm availability, occupancy limits, and key house rules.',
  'rules-acknowledgment': 'Rules acknowledgments should summarize quiet hours and core house rules.',
  'pool-help': 'Pool responses should include availability, safety, and heating caveats.',
  'spa-help': 'Spa responses should include usage boundaries and safety guidance.',
  'sauna-help': 'Sauna responses should include availability and safety guidance.',
  'refund-request': 'Refund requests are always reviewed by host operations manually.',
  threat: 'Threat scenarios must be escalated immediately for manual handling.',
  injury: 'Injury scenarios must be escalated immediately for manual handling.',
  accusation: 'Accusation scenarios must be escalated for manual handling and legal review.',
  'guest-message': 'Acknowledge the guest request and ask clarifying questions when details are incomplete.'
};

const messagingIntentV1Taxonomy: MessagingIntentV1[] = [
  'booking-inquiry',
  'rules-acknowledgment',
  'arrival-checkin',
  'checkout-guidance',
  'pool-help',
  'early-check-in-request',
  'late-checkout-request',
  'spa-help',
  'sauna-help',
  'refund-request',
  'threat',
  'injury',
  'accusation'
];

const highStakesManualOnlyIntents = new Set<MessagingIntentV1>(['refund-request', 'threat', 'injury', 'accusation']);

const buildDraftBody = (input: CreateDraftInput, policyText: string) => {
  const guest = typeof input.context.guestName === 'string' ? input.context.guestName : 'there';
  return `Hi ${guest}, this is your ${input.intent.replace(/-/g, ' ')} update. ${policyText}`;
};

const buildSources = (input: CreateDraftInput, policyText: string) => [
  {
    type: 'policy' as const,
    label: `${input.intent} policy`,
    snippet: policyText,
    confidence: 'high' as const,
    referenceUrl: `https://docs.walt.local/policies/${input.intent}`,
    referenceId: `policy:${input.intent}`
  },
  {
    type: 'reservation' as const,
    label: `Reservation ${input.reservationId}`,
    snippet: JSON.stringify(input.context),
    confidence: 'medium' as const,
    referenceUrl: `https://docs.walt.local/reservations/${input.reservationId}`,
    referenceId: `reservation:${input.reservationId}`
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
        snippet: 'Check-in is available after 4:00 PM.',
        confidence: 'high',
        referenceUrl: 'https://docs.walt.local/policies/check-in-reminder',
        referenceId: 'policy:check-in-reminder'
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

const detectIntentFromGuestMessage = (message: string): string => {
  const normalized = message.toLowerCase();
  if (
    normalized.includes('available') ||
    normalized.includes('availability') ||
    normalized.includes('book') ||
    normalized.includes('dates')
  ) {
    return 'booking-inquiry';
  }
  if (normalized.includes('check in early') || normalized.includes('early check in')) {
    return 'early-check-in-request';
  }
  if (normalized.includes('late check out') || normalized.includes('late checkout')) {
    return 'late-checkout-request';
  }
  if (normalized.includes('wifi')) {
    return 'wifi-help';
  }
  if (normalized.includes('parking')) {
    return 'parking-help';
  }
  return 'guest-message';
};

const propertyNotesByIntent: Record<string, string> = {
  'early-check-in-request': 'Check cleaning completion and lock readiness before offering early check-in.',
  'late-checkout-request': 'Verify same-day turnover and cleaner schedule before confirming late checkout.',
  'wifi-help': 'Use the latest network details from property profile.',
  'parking-help': 'Confirm parking zone rules and permit requirements.',
  'booking-inquiry': 'Confirm occupancy rules and quiet hours in first response.'
};

const confidenceRank: Record<'low' | 'medium' | 'high', number> = {
  low: 0,
  medium: 1,
  high: 2
};

export const getRiskTrustIndicator = (input: {
  intent: string;
  body: string;
}): {
  risk: 'low' | 'medium' | 'high';
  trust: 'low' | 'medium' | 'high';
  reason: string;
} => {
  const normalized = input.body.toLowerCase();
  const suspiciousTerms = ['party', 'cash', 'offline', 'off-platform', 'wire transfer', 'outside app'];
  if (suspiciousTerms.some((term) => normalized.includes(term))) {
    return {
      risk: 'high',
      trust: 'low',
      reason: 'Message contains high-risk booking cues.'
    };
  }

  if (input.intent === 'booking-inquiry') {
    return {
      risk: 'medium',
      trust: 'medium',
      reason: 'Booking inquiry requires normal trust review.'
    };
  }

  return {
    risk: 'low',
    trust: 'high',
    reason: 'Routine operational message.'
  };
};

const getQueuePriorityScore = (item: QueueItem): number => {
  const riskTrust = getRiskTrustIndicator({ intent: item.intent, body: item.body });
  const riskScore = riskTrust.risk === 'high' ? 120 : riskTrust.risk === 'medium' ? 70 : 30;
  const intentScore =
    item.intent === 'early-check-in-request' || item.intent === 'late-checkout-request'
      ? 30
      : item.intent === 'booking-inquiry'
        ? 20
        : 10;
  const statusScore = item.status === 'pending' || item.status === 'edited' ? 20 : 0;
  const ageHours = Math.max(0, (Date.now() - new Date(item.createdAt).getTime()) / 3_600_000);
  const ageScore = Math.min(20, Math.floor(ageHours));
  return riskScore + intentScore + statusScore + ageScore;
};

export const createStore = (options: StoreOptions = {}): Store => {
  const queue = [...(options.seed ?? [makeSeedItem()])];
  const events: DraftEvent[] = [];
  const eventRecords: EventRecord[] = [];
  const outbox: OutboxRecord[] = [];
  const incidents: Incident[] = [];
  const incidentTimeline: IncidentTimelineEntry[] = [];
  const cleanerJitPings: CleanerJitPing[] = [];
  const monitoringAlerts: MonitoringAlert[] = [];
  const autopilotActions: AutopilotAction[] = [];
  const trainingSignals: TrainingSignal[] = [];
  const policiesByIntent = { ...defaultPoliciesByIntent, ...(options.policiesByIntent ?? {}) };
  let internalValidationComplete = false;
  const onboardedHosts: HostOnboarding[] = [];
  const targetHostCount = 10;
  let totalRefundAmount = 0;
  const guestReviews: number[] = [];
  let eventSequence = 0;
  const operatingProfile: OperatingProfile = {
    strictness: 60,
    generosity: 40,
    compensationCapUsd: 150,
    economicSensitivity: 50,
    propertyRiskTolerance: {},
    updatedAt: nowIso()
  };
  const propertyBrainProfiles = new Map<string, PropertyBrainProfile>();
  const hospitableByEventId = new Map<string, string>();
  let lastMonitoringRunAt = nowIso();

  const createEmptyPropertyBrain = (propertyId: string): PropertyBrainProfile => ({
    propertyId,
    coreRules: { houseRules: [] },
    earlyLatePolicy: {},
    arrivalGuide: {},
    cleanerPreferences: {},
    amenityPolicies: {},
    amenityImportanceIndex: {},
    voiceProfile: {},
    escalationMatrix: { alwaysManualScenarios: [] },
    auditLog: [],
    updatedAt: nowIso()
  });

  const getOrCreatePropertyBrain = (propertyId: string): PropertyBrainProfile => {
    const existing = propertyBrainProfiles.get(propertyId);
    if (existing) {
      return existing;
    }
    const created = createEmptyPropertyBrain(propertyId);
    propertyBrainProfiles.set(propertyId, created);
    return created;
  };

  const propertyBrainCompleteness = (profile: PropertyBrainProfile): PropertyBrainCompleteness => ({
    coreRules: Boolean(
      profile.coreRules.checkInTime &&
        profile.coreRules.checkOutTime &&
        profile.coreRules.maxOccupancy &&
        profile.coreRules.quietHours &&
        profile.coreRules.houseRules.length > 0
    ),
    earlyLatePolicy: Boolean(profile.earlyLatePolicy.earlyCheckIn && profile.earlyLatePolicy.lateCheckout),
    arrivalGuide: Boolean(profile.arrivalGuide.entryMethod && profile.arrivalGuide.lockInstructions && profile.arrivalGuide.parkingInstructions),
    cleanerPreferences: Boolean(profile.cleanerPreferences.channel && profile.cleanerPreferences.contact && profile.cleanerPreferences.requiredFormat),
    amenityPolicies: Boolean(profile.amenityPolicies.poolHeating || profile.amenityPolicies.hotTub || profile.amenityPolicies.sauna),
    voiceProfile: Boolean(profile.voiceProfile.tone || profile.voiceProfile.emojiUse || profile.voiceProfile.strictness),
    escalationMatrix: profile.escalationMatrix.alwaysManualScenarios.length > 0
  });

  const emit = (
    type: DraftEventType,
    payload: Record<string, unknown>,
    metadata: { aggregateType: EventRecord['aggregateType']; aggregateId: string; actorId: string }
  ) => {
    const timestamp = nowIso();
    const sequence = eventSequence + 1;
    eventSequence = sequence;
    events.push({ type, payload, timestamp });
    eventRecords.push({
      sequence,
      type,
      payload,
      timestamp,
      aggregateType: metadata.aggregateType,
      aggregateId: metadata.aggregateId,
      actorId: metadata.actorId
    });
    const destinations: OutboxDestination[] = ['audit-log', 'projection-updater'];
    if (type === 'message.ingested') {
      destinations.push('notifications');
    }
    for (const destination of destinations) {
      outbox.unshift({
        id: nextOutboxId(),
        eventSequence: sequence,
        destination,
        status: 'pending',
        attempts: 0,
        payload: {
          type,
          aggregateType: metadata.aggregateType,
          aggregateId: metadata.aggregateId,
          actorId: metadata.actorId
        },
        createdAt: timestamp,
        updatedAt: timestamp
      });
    }
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

  const byCleanerPingId = (id: string) => {
    const ping = cleanerJitPings.find((entry) => entry.id === id);
    if (!ping) {
      throw new Error(`Cleaner JIT ping not found: ${id}`);
    }
    return ping;
  };

  const parseGuestName = (item: QueueItem) => {
    const fromBody = /^Guest\s+([^:]+):/i.exec(item.body)?.[1]?.trim();
    if (fromBody && fromBody.length > 0) {
      return fromBody;
    }
    const fromSource = item.sources
      .map((source) => source.snippet)
      .find((snippet) => snippet.toLowerCase().startsWith('guest '));
    if (fromSource) {
      return fromSource.replace(/^guest\s+/i, '').trim();
    }
    return 'there';
  };

  const assembleContext = (draftId: string): AssembledContext => {
    const item = byId(draftId);
    const policy =
      policiesByIntent[item.intent] ??
      defaultPoliciesByIntent['guest-message'] ??
      'Acknowledge guest message and confirm details before final response.';
    const propertyNote = propertyNotesByIntent[item.intent] ?? 'Use property profile and reservation context for response.';
    const knowledgeSources = ([
      {
        type: 'policy',
        label: `${item.intent} policy`,
        snippet: policy,
        confidence: 'high',
        referenceUrl: `https://docs.walt.local/policies/${item.intent}`,
        referenceId: `policy:${item.intent}`
      },
      ...item.sources,
      {
        type: 'property-note',
        label: 'Property knowledge',
        snippet: propertyNote,
        confidence: 'low',
        referenceUrl: `https://docs.walt.local/properties/${item.reservationId}/knowledge`,
        referenceId: `property-note:${item.reservationId}`
      }
    ] as QueueItem['sources']).sort((left, right) => {
      const leftRank = left.confidence ? confidenceRank[left.confidence] : 3;
      const rightRank = right.confidence ? confidenceRank[right.confidence] : 3;
      return leftRank - rightRank;
    });

    return {
      draftId: item.id,
      reservationId: item.reservationId,
      intent: item.intent,
      guestName: parseGuestName(item),
      policy,
      knowledgeSources,
      reviewRequired: knowledgeSources.some((source) => source.confidence === 'low')
    };
  };

  const buildInboundDraftBody = (context: AssembledContext) => {
    const intentText = context.intent.replace(/-/g, ' ');
    return `Hi ${context.guestName}, thanks for your ${intentText} message. ${context.policy}`;
  };

  const sortedQueue = () =>
    [...queue].sort((left, right) => {
      const priorityDelta = getQueuePriorityScore(right) - getQueuePriorityScore(left);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      return right.updatedAt.localeCompare(left.updatedAt);
    });

  const upsertMonitoringAlert = (input: {
    propertyId: string;
    reservationId?: string;
    category: MonitoringCategory;
    severity: MonitoringSeverity;
    summary: string;
  }): MonitoringAlert => {
    const existing = monitoringAlerts.find(
      (alert) =>
        alert.propertyId === input.propertyId &&
        alert.reservationId === input.reservationId &&
        alert.category === input.category &&
        alert.summary === input.summary &&
        alert.status !== 'resolved'
    );
    if (existing) {
      return existing;
    }
    const ts = nowIso();
    const created: MonitoringAlert = {
      id: nextMonitoringAlertId(),
      propertyId: input.propertyId,
      reservationId: input.reservationId,
      category: input.category,
      severity: input.severity,
      status: 'open',
      summary: input.summary,
      detectedAt: ts,
      updatedAt: ts
    };
    monitoringAlerts.unshift(created);
    return created;
  };

  const autopilotSafeIntents = new Set(['wifi-help', 'parking-help', 'guest-message']);

  return {
    listQueue: () => sortedQueue(),

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
      emit('draft.created', { id: item.id, intent: item.intent }, { aggregateType: 'draft', aggregateId: item.id, actorId: 'system' });
      return item;
    },

    editDraft: (id, body, actorId = 'host-user') => {
      const item = byId(id);
      if (item.status === 'sent') {
        throw new Error('Sent drafts cannot be edited.');
      }
      if (item.status === 'rejected') {
        throw new Error('Rejected drafts cannot be edited.');
      }
      const ts = nowIso();
      const before = item.body;
      const beforeStatus = item.status;
      item.body = body;
      item.status = 'edited';
      item.updatedAt = ts;
      item.auditLog.push({
        action: 'edited',
        actorId,
        timestamp: ts,
        before: { body: before, status: beforeStatus },
        after: { body, status: 'edited' }
      });
      trainingSignals.push({
        draftId: item.id,
        intent: item.intent,
        before,
        after: body,
        capturedAt: ts
      });
      emit('draft.edited', { id: item.id }, { aggregateType: 'draft', aggregateId: item.id, actorId });
      return item;
    },

    approveDraft: (id, actorId) => {
      const item = byId(id);
      if (item.status === 'sent') {
        throw new Error('Sent drafts cannot be approved again.');
      }
      if (item.status === 'rejected') {
        throw new Error('Rejected drafts cannot be approved.');
      }
      const ts = nowIso();
      const beforeStatus = item.status;
      item.status = 'approved';
      item.updatedAt = ts;
      item.auditLog.push({
        action: 'approved',
        actorId,
        timestamp: ts,
        before: { status: beforeStatus },
        after: { status: 'approved' }
      });
      emit('draft.approved', { id: item.id, actorId }, { aggregateType: 'draft', aggregateId: item.id, actorId });
      return item;
    },

    sendDraft: (id, actorId) => {
      const item = byId(id);
      if (item.status !== 'approved') {
        throw new Error('Draft must be approved before sending.');
      }
      const ts = nowIso();
      const beforeStatus = item.status;
      item.status = 'sent';
      item.updatedAt = ts;
      item.auditLog.push({
        action: 'sent',
        actorId,
        timestamp: ts,
        before: { status: beforeStatus },
        after: { status: 'sent' }
      });
      emit('draft.sent', { id: item.id, actorId }, { aggregateType: 'draft', aggregateId: item.id, actorId });
      return item;
    },

    rejectDraft: (id, actorId) => {
      const item = byId(id);
      if (item.status === 'rejected') {
        throw new Error('Draft is already rejected.');
      }
      if (item.status === 'sent') {
        throw new Error('Sent drafts cannot be rejected.');
      }
      const ts = nowIso();
      const beforeStatus = item.status;
      item.status = 'rejected';
      item.updatedAt = ts;
      item.auditLog.push({
        action: 'rejected',
        actorId,
        timestamp: ts,
        before: { status: beforeStatus },
        after: { status: 'rejected' }
      });
      emit('draft.rejected', { id: item.id, actorId }, { aggregateType: 'draft', aggregateId: item.id, actorId });
      return item;
    },

    listEvents: () => [...events],

    listEventRecords: (filters = {}) =>
      eventRecords
        .filter((event) => !filters.type || event.type === filters.type)
        .filter((event) => !filters.actorId || event.actorId === filters.actorId)
        .sort((left, right) => right.sequence - left.sequence)
        .slice(0, Math.max(1, Math.min(200, filters.limit ?? 50))),

    listOutboxRecords: (filters = {}) =>
      outbox
        .filter((record) => !filters.destination || record.destination === filters.destination)
        .filter((record) => !filters.status || record.status === filters.status)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .slice(0, Math.max(1, Math.min(200, filters.limit ?? 50))),

    retryOutboxByDestination: (input) => {
      const limit = Math.max(1, Math.min(200, input.limit ?? 25));
      const candidates = outbox
        .filter((record) => record.destination === input.destination)
        .filter((record) => record.status !== 'delivered')
        .slice(0, limit);

      const now = Date.now();
      for (const record of candidates) {
        record.attempts += 1;
        record.updatedAt = nowIso();
        if (record.destination === 'notifications' && record.attempts < 2) {
          record.status = 'retrying';
          record.lastError = 'Transient provider timeout';
          record.nextAttemptAt = new Date(now + 30_000).toISOString();
          continue;
        }
        record.status = 'delivered';
        record.lastError = undefined;
        record.nextAttemptAt = undefined;
      }

      return candidates;
    },

    getApprovalQueueProjection: (limit = 20) => {
      const items = sortedQueue()
        .filter((item) => item.status === 'pending' || item.status === 'edited' || item.status === 'approved')
        .slice(0, Math.max(1, Math.min(100, limit)))
        .map((item) => {
          const risk = getRiskTrustIndicator({ intent: item.intent, body: item.body }).risk;
          const priority: 'critical' | 'high' | 'normal' =
            risk === 'high' ? 'critical' : risk === 'medium' ? 'high' : 'normal';
          return {
            draftId: item.id,
            reservationId: item.reservationId,
            intent: item.intent,
            status: item.status,
            updatedAt: item.updatedAt,
            priority
          };
        });

      return {
        kind: 'approval-queue' as const,
        generatedAt: nowIso(),
        total: queue.filter((item) => item.status === 'pending' || item.status === 'edited' || item.status === 'approved').length,
        items
      };
    },

    getPropertyStateProjection: (limit = 20) => {
      const propertyIds = new Set<string>();
      for (const item of queue) {
        propertyIds.add(propertyIdFromReservation(item.reservationId));
      }
      for (const alert of monitoringAlerts) {
        propertyIds.add(alert.propertyId);
      }
      for (const ping of cleanerJitPings) {
        propertyIds.add(propertyIdFromReservation(ping.reservationId));
      }

      const snapshots = [...propertyIds]
        .map((propertyId) => {
          const openAlerts = monitoringAlerts.filter(
            (alert) => alert.propertyId === propertyId && alert.status === 'open'
          );
          const highSeverityAlerts = openAlerts.filter((alert) => alert.severity === 'high').length;
          const pendingCleanerPings = cleanerJitPings.filter(
            (ping) =>
              propertyIdFromReservation(ping.reservationId) === propertyId &&
              (ping.status === 'requested' || ping.status === 'NOT_READY')
          ).length;
          const vendorConflicts = openAlerts.filter((alert) => alert.category === 'vendor-window').length;
          const maintenanceIssues = incidents.filter(
            (incident) => incident.state !== 'normalized' && incident.summary.toLowerCase().includes('maintenance')
          ).length;
          const criticalAmenityIssues = openAlerts.filter(
            (alert) => alert.category === 'amenity-issue' && alert.severity === 'high'
          ).length;
          const blockers = openAlerts.filter((alert) => alert.severity === 'high').map((alert) => alert.summary);
          const readiness: PropertyReadiness =
            highSeverityAlerts > 0 || pendingCleanerPings > 0 || criticalAmenityIssues > 0
              ? 'blocked'
              : openAlerts.length > 0 || vendorConflicts > 0 || maintenanceIssues > 0
                ? 'at-risk'
                : 'ready';

          return {
            propertyId,
            readiness,
            blockers,
            signals: {
              openAlerts: openAlerts.length,
              highSeverityAlerts,
              pendingCleanerPings,
              vendorConflicts,
              maintenanceIssues,
              criticalAmenityIssues
            },
            updatedAt: nowIso()
          };
        })
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

      return {
        kind: 'property-state' as const,
        generatedAt: nowIso(),
        total: snapshots.length,
        items: snapshots.slice(0, Math.max(1, Math.min(100, limit)))
      };
    },

    getNormalizedEntities: (kind = 'all') => {
      const propertiesMap = new Map<string, NormalizedProperty>();
      const reservationsMap = new Map<string, NormalizedReservation>();
      const guestsMap = new Map<string, NormalizedGuest>();
      const messages: NormalizedMessage[] = [];

      const activeIncidentCount = incidents.filter((incident) => incident.state !== 'normalized').length;

      for (const item of queue) {
        const propertyId = propertyIdFromReservation(item.reservationId);
        const guestName = parseGuestName(item);
        const guestId = `guest:${slugify(guestName)}:${item.reservationId}`;
        const messageId = `message:${item.id}`;
        const direction: NormalizedMessage['direction'] = item.body.toLowerCase().startsWith('guest ') ? 'inbound' : 'outbound';

        const existingProperty = propertiesMap.get(propertyId);
        propertiesMap.set(propertyId, {
          propertyId,
          reservationCount: (existingProperty?.reservationCount ?? 0) + 1,
          messageCount: (existingProperty?.messageCount ?? 0) + 1,
          activeIncidentCount,
          lastActivityAt:
            existingProperty && existingProperty.lastActivityAt > item.updatedAt ? existingProperty.lastActivityAt : item.updatedAt
        });

        const existingReservation = reservationsMap.get(item.reservationId);
        reservationsMap.set(item.reservationId, {
          reservationId: item.reservationId,
          propertyId,
          guestName,
          draftCount: (existingReservation?.draftCount ?? 0) + 1,
          lastIntent: item.intent,
          status: item.status,
          updatedAt: item.updatedAt
        });

        const existingGuest = guestsMap.get(guestId);
        guestsMap.set(guestId, {
          guestId,
          guestName,
          reservationIds: existingGuest ? Array.from(new Set([...existingGuest.reservationIds, item.reservationId])) : [item.reservationId],
          messageCount: (existingGuest?.messageCount ?? 0) + 1,
          lastMessageAt:
            existingGuest && existingGuest.lastMessageAt > item.updatedAt ? existingGuest.lastMessageAt : item.updatedAt
        });

        messages.push({
          messageId,
          reservationId: item.reservationId,
          guestName,
          direction,
          body: item.body,
          intent: item.intent,
          createdAt: item.createdAt
        });
      }

      const all = {
        properties: [...propertiesMap.values()].sort((left, right) => right.lastActivityAt.localeCompare(left.lastActivityAt)),
        guests: [...guestsMap.values()].sort((left, right) => right.lastMessageAt.localeCompare(left.lastMessageAt)),
        reservations: [...reservationsMap.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
        messages: messages.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      };

      if (kind === 'all') {
        return all;
      }

      return {
        properties: kind === 'properties' ? all.properties : [],
        guests: kind === 'guests' ? all.guests : [],
        reservations: kind === 'reservations' ? all.reservations : [],
        messages: kind === 'messages' ? all.messages : []
      };
    },

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
      incidentTimeline.push({
        incidentId: incident.id,
        state: 'active',
        actorId: 'system',
        timestamp: ts,
        note: summary
      });
      emit('incident.created', { incidentId: incident.id, summary }, { aggregateType: 'incident', aggregateId: incident.id, actorId: 'system' });
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
      incidentTimeline.push({
        incidentId: id,
        state: next,
        actorId: 'system',
        timestamp: incident.updatedAt,
        note: `Transitioned to ${next}`
      });
      emit('incident.transitioned', { incidentId: id, next }, { aggregateType: 'incident', aggregateId: id, actorId: 'system' });
      return incident;
    },

    listIncidents: () => [...incidents],

    listCleanerJitPings: (reservationId) =>
      cleanerJitPings
        .filter((ping) => !reservationId || ping.reservationId === reservationId)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),

    createCleanerJitPing: (input) => {
      const ts = nowIso();
      const ping: CleanerJitPing = {
        id: nextCleanerPingId(),
        reservationId: input.reservationId,
        cleanerId: input.cleanerId,
        reason: input.reason,
        status: 'requested',
        createdAt: ts,
        updatedAt: ts
      };
      cleanerJitPings.unshift(ping);
      return ping;
    },

    updateCleanerJitPing: (id, input) => {
      const ping = byCleanerPingId(id);
      if (input.status === 'ETA') {
        if (!Number.isInteger(input.etaMinutes) || (input.etaMinutes ?? 0) <= 0) {
          throw new Error('etaMinutes is required when status is ETA.');
        }
      }
      if ((input.status === 'READY' || input.status === 'NOT_READY') && input.etaMinutes !== undefined) {
        throw new Error('etaMinutes is only allowed when status is ETA.');
      }

      ping.status = input.status;
      ping.note = input.note;
      ping.etaMinutes = input.status === 'ETA' ? input.etaMinutes : undefined;
      ping.updatedAt = nowIso();
      return ping;
    },

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
            timestamp: entry.timestamp,
            before: entry.before,
            after: entry.after
          }))
        )
        .filter((entry) => !filters.draftId || entry.draftId === filters.draftId)
        .filter((entry) => !filters.actorId || entry.actorId === filters.actorId)
        .filter((entry) => !filters.action || entry.action === filters.action)
        .filter((entry) => !filters.since || entry.timestamp >= filters.since)
        .filter((entry) => !filters.until || entry.timestamp <= filters.until)
        .sort((left, right) => right.timestamp.localeCompare(left.timestamp)),

    ingestHospitableMessage: (input) => {
      const existingDraftId = hospitableByEventId.get(input.eventId);
      if (existingDraftId) {
        return { item: byId(existingDraftId), duplicated: true };
      }

      const ts = input.sentAt ?? nowIso();
      const item: QueueItem = {
        id: nextId(),
        reservationId: input.reservationId,
        intent: detectIntentFromGuestMessage(input.message),
        body: `Guest ${input.guestName}: ${input.message}`,
        status: 'pending',
        createdAt: ts,
        updatedAt: ts,
        sources: [
          {
            type: 'reservation',
            label: `Reservation ${input.reservationId}`,
            snippet: `Guest ${input.guestName}`,
            confidence: 'medium',
            referenceUrl: `https://docs.walt.local/reservations/${input.reservationId}`,
            referenceId: `reservation:${input.reservationId}`
          },
          {
            type: 'property-note',
            label: 'Hospitable webhook',
            snippet: `eventId=${input.eventId}`,
            confidence: 'high',
            referenceUrl: `https://docs.walt.local/integrations/hospitable/events/${input.eventId}`,
            referenceId: `hospitable:${input.eventId}`
          }
        ],
        auditLog: [
          {
            action: 'created',
            actorId: 'hospitable-webhook',
            timestamp: ts
          }
        ]
      };

      hospitableByEventId.set(input.eventId, item.id);
      queue.unshift(item);
      emit('message.ingested', { id: item.id, eventId: input.eventId }, { aggregateType: 'integration', aggregateId: input.eventId, actorId: 'hospitable-webhook' });
      return { item, duplicated: false };
    },

    assembleContextByDraftId: (draftId) => assembleContext(draftId),

    regenerateDraftFromInbound: (draftId) => {
      const item = byId(draftId);
      const context = assembleContext(draftId);
      const ts = nowIso();
      const beforeBody = item.body;
      const beforeSourceCount = item.sources.length;

      item.body = buildInboundDraftBody(context);
      item.updatedAt = ts;
      item.sources = context.knowledgeSources;
      item.auditLog.push({
        action: 'edited',
        actorId: 'ai-orchestrator',
        timestamp: ts,
        before: { body: beforeBody, sourceCount: beforeSourceCount },
        after: { body: item.body, sourceCount: item.sources.length }
      });
      emit('draft.edited', { id: item.id, actorId: 'ai-orchestrator' }, { aggregateType: 'draft', aggregateId: item.id, actorId: 'ai-orchestrator' });
      return item;
    },

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

    getRoiMetrics: () => getRoi(),

    getTodayPriorities: (limit = 5) =>
      sortedQueue()
        .filter((item) => item.status === 'pending' || item.status === 'edited' || item.status === 'approved')
        .slice(0, Math.max(1, Math.min(20, limit)))
        .map((item) => {
          const riskTrust = getRiskTrustIndicator({ intent: item.intent, body: item.body });
          const priority: TodayPriority['priority'] =
            riskTrust.risk === 'high' ? 'critical' : riskTrust.risk === 'medium' ? 'high' : 'normal';
          const recommendedAction: TodayPriority['recommendedAction'] =
            item.status === 'approved' ? 'send-now' : item.status === 'edited' ? 'approve-or-edit' : 'review-now';
          return {
            draftId: item.id,
            reservationId: item.reservationId,
            intent: item.intent,
            status: item.status,
            risk: riskTrust.risk,
            trust: riskTrust.trust,
            reason: riskTrust.reason,
            priority,
            recommendedAction,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt
          };
        }),

    getProactiveSuggestions: (limit = 5) =>
      sortedQueue()
        .filter((item) => item.status === 'pending' || item.status === 'edited' || item.status === 'approved')
        .slice(0, Math.max(1, Math.min(20, limit)))
        .map((item) => {
          const riskTrust = getRiskTrustIndicator({ intent: item.intent, body: item.body });
          const priority: ProactiveSuggestion['priority'] =
            riskTrust.risk === 'high' ? 'high' : riskTrust.risk === 'medium' ? 'medium' : 'low';

          if (item.intent === 'check-in-reminder') {
            return {
              kind: 'check-in' as const,
              draftId: item.id,
              reservationId: item.reservationId,
              intent: item.intent,
              priority,
              reason: 'Upcoming arrival communication is pending.',
              suggestedMessage: 'Share check-in details and arrival instructions before arrival window.'
            };
          }

          if (item.intent === 'first-morning-check') {
            return {
              kind: 'first-morning' as const,
              draftId: item.id,
              reservationId: item.reservationId,
              intent: item.intent,
              priority,
              reason: 'First-morning follow-up helps prevent avoidable issues.',
              suggestedMessage: 'Send a quick first-morning check and offer fast support for amenities.'
            };
          }

          if (item.intent === 'late-checkout-request') {
            return {
              kind: 'checkout' as const,
              draftId: item.id,
              reservationId: item.reservationId,
              intent: item.intent,
              priority,
              reason: 'Checkout expectations require proactive confirmation.',
              suggestedMessage: 'Confirm checkout timing, fees, and turnover constraints before final approval.'
            };
          }

          return {
            kind: 'heads-up' as const,
            draftId: item.id,
            reservationId: item.reservationId,
            intent: item.intent,
            priority,
            reason: 'Potential guest friction detected; send a proactive clarification.',
            suggestedMessage: 'Send a proactive heads-up to set expectations for early check-in readiness.'
          };
        }),

    listIncidentAlertDrafts: () =>
      incidents
        .filter((incident) => incident.state !== 'normalized')
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .map((incident) => {
          const urgency: IncidentAlertDraft['urgency'] =
            incident.state === 'active' || incident.state === 'negotiation' ? 'immediate' : 'high';
          const hostAlert = `[${urgency.toUpperCase()}] Incident ${incident.id} is ${incident.state}: ${incident.summary}`;
          const guestDraft = `Hi there, we want to keep you updated. We're actively working on "${incident.summary}" and will share the next update shortly.`;
          return {
            incidentId: incident.id,
            incidentState: incident.state,
            hostAlert,
            guestDraft,
            urgency,
            guestChannel: 'in-app-message' as const,
            hostChannel: 'command-center-alert' as const,
            updatedAt: incident.updatedAt
          };
        }),

    getPortfolioTrend: () => {
      const unresolvedIncidents = incidents.filter((incident) => incident.state !== 'normalized').length;
      const refundPressure = totalRefundAmount;
      const reviewAverage =
        guestReviews.length > 0 ? guestReviews.reduce((total, score) => total + score, 0) / guestReviews.length : 5;
      const openAmenityAlerts = monitoringAlerts.filter(
        (alert) => alert.category === 'amenity-issue' && alert.status === 'open'
      ).length;

      const incidentTrend: PortfolioTrend['incidentTrend'] =
        unresolvedIncidents >= 3 ? 'degrading' : unresolvedIncidents > 0 ? 'stable' : 'improving';
      const refundTrend: PortfolioTrend['refundTrend'] =
        refundPressure >= 300 ? 'degrading' : refundPressure > 0 ? 'stable' : 'improving';
      const amenityReliability: PortfolioTrend['amenityReliability'] =
        openAmenityAlerts >= 3 ? 'low' : openAmenityAlerts > 0 ? 'medium' : 'high';
      const reviewQualityTrend: PortfolioTrend['reviewQualityTrend'] =
        reviewAverage >= 4.7 ? 'improving' : reviewAverage >= 4.2 ? 'stable' : 'degrading';

      return {
        incidentTrend,
        refundTrend,
        amenityReliability,
        reviewQualityTrend,
        generatedAt: nowIso()
      };
    },

    getOperatingProfile: () => ({ ...operatingProfile, propertyRiskTolerance: { ...operatingProfile.propertyRiskTolerance } }),

    updateOperatingProfile: (input) => {
      if (input.strictness !== undefined) {
        if (input.strictness < 0 || input.strictness > 100) {
          throw new Error('strictness must be between 0 and 100.');
        }
        operatingProfile.strictness = input.strictness;
      }
      if (input.generosity !== undefined) {
        if (input.generosity < 0 || input.generosity > 100) {
          throw new Error('generosity must be between 0 and 100.');
        }
        operatingProfile.generosity = input.generosity;
      }
      if (input.compensationCapUsd !== undefined) {
        if (input.compensationCapUsd < 0 || input.compensationCapUsd > 5000) {
          throw new Error('compensationCapUsd must be between 0 and 5000.');
        }
        operatingProfile.compensationCapUsd = input.compensationCapUsd;
      }
      if (input.economicSensitivity !== undefined) {
        if (input.economicSensitivity < 0 || input.economicSensitivity > 100) {
          throw new Error('economicSensitivity must be between 0 and 100.');
        }
        operatingProfile.economicSensitivity = input.economicSensitivity;
      }
      if (input.propertyRiskTolerance) {
        for (const value of Object.values(input.propertyRiskTolerance)) {
          if (value < 0 || value > 100) {
            throw new Error('propertyRiskTolerance values must be between 0 and 100.');
          }
        }
        operatingProfile.propertyRiskTolerance = { ...input.propertyRiskTolerance };
      }
      operatingProfile.updatedAt = nowIso();
      return { ...operatingProfile, propertyRiskTolerance: { ...operatingProfile.propertyRiskTolerance } };
    },

    assessRiskTrustIntelligence: (input) => {
      const propertyStrictness = operatingProfile.propertyRiskTolerance[input.propertyId] ?? operatingProfile.strictness;
      const riskScore = Math.round(
        input.bookingPatternSignals * 0.25 +
          input.profileQualitySignals * 0.2 +
          input.languageCues * 0.2 +
          input.policyViolationFlags * 0.35
      );
      const trustScore = Math.round(
        input.positiveReviewHistory * 0.4 + input.responseQuality * 0.3 + input.explicitRuleAcceptance * 0.3
      );

      const economicPenalty = Math.round((operatingProfile.economicSensitivity / 100) * 15);
      const strictnessPenalty = Math.round((propertyStrictness / 100) * 20);
      const generosityCredit = Math.round((operatingProfile.generosity / 100) * 10);
      const compensationPenalty = Math.round((100 - Math.min(100, (operatingProfile.compensationCapUsd / 500) * 100)) * 0.1);
      const decisionIndex = riskScore + strictnessPenalty + economicPenalty + compensationPenalty - trustScore - generosityCredit;

      const recommendation: RiskTrustAssessment['recommendation'] =
        decisionIndex >= 35 ? 'decline' : decisionIndex >= 5 ? 'manual-review' : 'approve-with-guardrails';

      const rationale = [
        `Risk score ${riskScore} from booking/profile/language/policy signals.`,
        `Trust score ${trustScore} from reviews/response quality/rule acceptance.`,
        `Operating profile adjustments: strictness +${strictnessPenalty}, economic +${economicPenalty}, generosity -${generosityCredit}.`,
        `Final decision index ${decisionIndex} -> ${recommendation}.`
      ];

      return {
        riskScore,
        trustScore,
        recommendation,
        factors: {
          bookingPatternSignals: input.bookingPatternSignals,
          profileQualitySignals: input.profileQualitySignals,
          languageCues: input.languageCues,
          policyViolationFlags: input.policyViolationFlags,
          positiveReviewHistory: input.positiveReviewHistory,
          responseQuality: input.responseQuality,
          explicitRuleAcceptance: input.explicitRuleAcceptance,
          strictness: propertyStrictness,
          generosity: operatingProfile.generosity,
          compensationCapUsd: operatingProfile.compensationCapUsd,
          economicSensitivity: operatingProfile.economicSensitivity
        },
        rationale
      };
    },

    evaluateAutopilotAction: (input) => {
      const propertyId = propertyIdFromReservation(input.reservationId);
      const riskTrust = getRiskTrustIndicator({ intent: input.intent, body: input.body });
      const tolerance = operatingProfile.propertyRiskTolerance[propertyId] ?? operatingProfile.strictness;
      const safeIntent = autopilotSafeIntents.has(input.intent);
      const decision: AutopilotAction['decision'] =
        safeIntent && riskTrust.risk !== 'high' && tolerance <= 70 ? 'auto-allowed' : 'manual-required';

      const ts = nowIso();
      const action: AutopilotAction = {
        id: nextAutopilotActionId(),
        reservationId: input.reservationId,
        propertyId,
        intent: input.intent,
        decision,
        status: decision === 'auto-allowed' ? 'executed' : 'manual',
        reason:
          decision === 'auto-allowed'
            ? 'Intent is in safe autopilot category with acceptable risk.'
            : 'Manual review required due to intent category, risk, or profile strictness.',
        createdAt: ts,
        updatedAt: ts
      };
      autopilotActions.unshift(action);
      return action;
    },

    rollbackAutopilotAction: (input) => {
      const action = autopilotActions.find((entry) => entry.id === input.actionId);
      if (!action) {
        throw new Error(`Autopilot action not found: ${input.actionId}`);
      }
      if (action.status === 'rolled_back') {
        throw new Error('Autopilot action is already rolled back.');
      }
      action.status = 'rolled_back';
      action.rollbackReason = input.reason;
      action.updatedAt = nowIso();
      return action;
    },

    listAutopilotActions: () => [...autopilotActions].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),

    runMonitoringAgents: () => {
      lastMonitoringRunAt = nowIso();
      const createdOrFound: MonitoringAlert[] = [];

      for (const item of sortedQueue()) {
        const propertyId = propertyIdFromReservation(item.reservationId);
        const riskTrust = getRiskTrustIndicator({ intent: item.intent, body: item.body });
        if (item.intent === 'early-check-in-request' || item.intent === 'late-checkout-request') {
          createdOrFound.push(
            upsertMonitoringAlert({
              propertyId,
              reservationId: item.reservationId,
              category: 'upcoming-check-in',
              severity: 'medium',
              summary: `Upcoming arrival timing request needs confirmation (${item.intent}).`
            })
          );
        }
        if (riskTrust.risk === 'high') {
          createdOrFound.push(
            upsertMonitoringAlert({
              propertyId,
              reservationId: item.reservationId,
              category: 'missing-confirmation',
              severity: 'high',
              summary: 'High-risk conversation cues require host confirmation before commitment.'
            })
          );
        }
      }

      for (const ping of cleanerJitPings) {
        if (ping.status === 'requested' || ping.status === 'NOT_READY') {
          createdOrFound.push(
            upsertMonitoringAlert({
              propertyId: propertyIdFromReservation(ping.reservationId),
              reservationId: ping.reservationId,
              category: 'vendor-window',
              severity: ping.status === 'NOT_READY' ? 'high' : 'medium',
              summary: `Cleaner readiness is ${ping.status} for reservation ${ping.reservationId}.`
            })
          );
        }
      }

      for (const incident of incidents) {
        if (incident.state !== 'normalized') {
          createdOrFound.push(
            upsertMonitoringAlert({
              propertyId: 'property:global',
              category: 'amenity-issue',
              severity: 'high',
              summary: `Incident ${incident.id} remains ${incident.state}: ${incident.summary}`
            })
          );
        }
      }

      return createdOrFound.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    },

    listMonitoringAlerts: (filters = {}) =>
      monitoringAlerts
        .filter((alert) => !filters.propertyId || alert.propertyId === filters.propertyId)
        .filter((alert) => !filters.reservationId || alert.reservationId === filters.reservationId)
        .filter((alert) => !filters.status || alert.status === filters.status)
        .filter((alert) => !filters.severity || alert.severity === filters.severity)
        .filter((alert) => !filters.category || alert.category === filters.category)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .slice(0, Math.max(1, Math.min(50, filters.limit ?? 20))),

    getMonitoringAgentStatus: () => ({
      alwaysOn: true,
      lastRunAt: lastMonitoringRunAt,
      monitoredConditions: [
        'upcoming-check-in-window',
        'missing-confirmation',
        'vendor-conflict',
        'maintenance-risk',
        'critical-amenity-risk'
      ]
    }),

    runJitChecks: (input) => {
      const checks: JitCheckResult['checks'] = [];
      const reservationPropertyId = propertyIdFromReservation(input.reservationId);
      const pendingCleaner = cleanerJitPings.some(
        (ping) =>
          ping.reservationId === input.reservationId && (ping.status === 'requested' || ping.status === 'NOT_READY')
      );
      checks.push({
        check: 'cleaner-readiness',
        status: pendingCleaner ? 'warning' : 'ok',
        detail: pendingCleaner ? 'Cleaner readiness is not confirmed.' : 'Cleaner readiness confirmed.'
      });

      const openAlerts = monitoringAlerts.filter(
        (alert) => alert.propertyId === reservationPropertyId && alert.status === 'open'
      );
      const highSeverityAlerts = openAlerts.filter((alert) => alert.severity === 'high').length;
      checks.push({
        check: 'property-readiness',
        status: highSeverityAlerts > 0 ? 'failed' : openAlerts.length > 0 ? 'warning' : 'ok',
        detail: highSeverityAlerts > 0 ? 'Property has blocking high-severity alerts.' : 'No blocking property alerts.'
      });

      const overlapRisk = input.requestType === 'late-checkout' && pendingCleaner;
      checks.push({
        check: 'overlap-risk',
        status: overlapRisk ? 'failed' : 'ok',
        detail: overlapRisk ? 'Late checkout overlaps with pending turnover operations.' : 'No overlap risk detected.'
      });

      const result: JitCheckResult['result'] = checks.some((check) => check.status === 'failed')
        ? 'block'
        : checks.some((check) => check.status === 'warning')
          ? 'review'
          : 'clear';
      return { result, checks };
    },

    getIncidentResponsePlan: (incidentId) => {
      const incident = byIncidentId(incidentId);
      const severityMultiplier = incident.state === 'active' ? 1 : incident.state === 'negotiation' ? 0.8 : 0.6;
      const compensationAmount = Math.round(Math.min(operatingProfile.compensationCapUsd, 120 * severityMultiplier));
      return {
        hostAlert: `[IMMEDIATE] Incident ${incident.id} is ${incident.state}: ${incident.summary}`,
        guestDraft: {
          body: `Hi there, we are actively addressing "${incident.summary}" and will share an update shortly.`,
          requiresApproval: true,
          channel: 'in-app-message'
        },
        compensationRecommendation: {
          amountUsd: compensationAmount,
          rationale: 'Separate recommendation based on state severity and operating profile cap.'
        }
      };
    },

    getIncidentTimeline: (incidentId) =>
      incidentTimeline
        .filter((entry) => entry.incidentId === incidentId)
        .sort((left, right) => left.timestamp.localeCompare(right.timestamp)),

    getPropertyBrainProfile: (propertyId) => {
      const profile = getOrCreatePropertyBrain(propertyId);
      return {
        ...profile,
        coreRules: { ...profile.coreRules, houseRules: [...profile.coreRules.houseRules] },
        earlyLatePolicy: {
          earlyCheckIn: profile.earlyLatePolicy.earlyCheckIn
            ? {
                ...profile.earlyLatePolicy.earlyCheckIn,
                priceTiers: [...profile.earlyLatePolicy.earlyCheckIn.priceTiers]
              }
            : undefined,
          lateCheckout: profile.earlyLatePolicy.lateCheckout
            ? {
                ...profile.earlyLatePolicy.lateCheckout,
                priceTiers: [...profile.earlyLatePolicy.lateCheckout.priceTiers]
              }
            : undefined
        },
        arrivalGuide: { ...profile.arrivalGuide },
        cleanerPreferences: { ...profile.cleanerPreferences },
        amenityPolicies: {
          poolHeating: profile.amenityPolicies.poolHeating
            ? { ...profile.amenityPolicies.poolHeating, caveats: [...profile.amenityPolicies.poolHeating.caveats] }
            : undefined,
          hotTub: profile.amenityPolicies.hotTub
            ? { ...profile.amenityPolicies.hotTub, safetyNotes: [...profile.amenityPolicies.hotTub.safetyNotes] }
            : undefined,
          sauna: profile.amenityPolicies.sauna
            ? { ...profile.amenityPolicies.sauna, safetyNotes: [...profile.amenityPolicies.sauna.safetyNotes] }
            : undefined
        },
        amenityImportanceIndex: { ...profile.amenityImportanceIndex },
        voiceProfile: { ...profile.voiceProfile },
        escalationMatrix: {
          ...profile.escalationMatrix,
          alwaysManualScenarios: [...profile.escalationMatrix.alwaysManualScenarios]
        },
        auditLog: [...profile.auditLog]
      };
    },

    updatePropertyBrainProfile: (propertyId, input, actorId) => {
      const profile = getOrCreatePropertyBrain(propertyId);
      const before: Record<string, unknown> = JSON.parse(JSON.stringify(profile));

      if (input.coreRules) {
        if (input.coreRules.maxOccupancy !== undefined && input.coreRules.maxOccupancy < 1) {
          throw new Error('coreRules.maxOccupancy must be at least 1.');
        }
        profile.coreRules = {
          ...profile.coreRules,
          ...input.coreRules,
          houseRules: input.coreRules.houseRules ? [...input.coreRules.houseRules] : profile.coreRules.houseRules
        };
      }

      if (input.earlyLatePolicy) {
        const validateTier = (tiers: Array<{ fromHour: number; toHour: number; amountUsd: number }>) => {
          for (const tier of tiers) {
            if (tier.fromHour < 0 || tier.fromHour > 23 || tier.toHour < 0 || tier.toHour > 23 || tier.amountUsd < 0) {
              throw new Error('earlyLatePolicy price tiers must have valid hour ranges and non-negative pricing.');
            }
          }
        };

        if (input.earlyLatePolicy.earlyCheckIn?.priceTiers) {
          validateTier(input.earlyLatePolicy.earlyCheckIn.priceTiers);
        }
        if (input.earlyLatePolicy.lateCheckout?.priceTiers) {
          validateTier(input.earlyLatePolicy.lateCheckout.priceTiers);
        }

        profile.earlyLatePolicy = {
          ...profile.earlyLatePolicy,
          ...input.earlyLatePolicy,
          earlyCheckIn: input.earlyLatePolicy.earlyCheckIn
            ? { ...input.earlyLatePolicy.earlyCheckIn, priceTiers: [...input.earlyLatePolicy.earlyCheckIn.priceTiers] }
            : profile.earlyLatePolicy.earlyCheckIn,
          lateCheckout: input.earlyLatePolicy.lateCheckout
            ? { ...input.earlyLatePolicy.lateCheckout, priceTiers: [...input.earlyLatePolicy.lateCheckout.priceTiers] }
            : profile.earlyLatePolicy.lateCheckout
        };
      }

      if (input.arrivalGuide) {
        profile.arrivalGuide = { ...profile.arrivalGuide, ...input.arrivalGuide };
      }

      if (input.cleanerPreferences) {
        profile.cleanerPreferences = { ...profile.cleanerPreferences, ...input.cleanerPreferences };
      }

      if (input.amenityPolicies) {
        profile.amenityPolicies = {
          ...profile.amenityPolicies,
          ...input.amenityPolicies,
          poolHeating: input.amenityPolicies.poolHeating
            ? { ...input.amenityPolicies.poolHeating, caveats: [...input.amenityPolicies.poolHeating.caveats] }
            : profile.amenityPolicies.poolHeating,
          hotTub: input.amenityPolicies.hotTub
            ? { ...input.amenityPolicies.hotTub, safetyNotes: [...input.amenityPolicies.hotTub.safetyNotes] }
            : profile.amenityPolicies.hotTub,
          sauna: input.amenityPolicies.sauna
            ? { ...input.amenityPolicies.sauna, safetyNotes: [...input.amenityPolicies.sauna.safetyNotes] }
            : profile.amenityPolicies.sauna
        };
      }

      if (input.amenityImportanceIndex) {
        profile.amenityImportanceIndex = { ...profile.amenityImportanceIndex, ...input.amenityImportanceIndex };
      }

      if (input.voiceProfile) {
        profile.voiceProfile = { ...profile.voiceProfile, ...input.voiceProfile };
      }

      if (input.escalationMatrix) {
        profile.escalationMatrix = {
          ...profile.escalationMatrix,
          ...input.escalationMatrix,
          alwaysManualScenarios: input.escalationMatrix.alwaysManualScenarios
            ? [...input.escalationMatrix.alwaysManualScenarios]
            : profile.escalationMatrix.alwaysManualScenarios
        };
      }

      profile.updatedAt = nowIso();
      profile.auditLog.push({
        action: 'profile.updated',
        actorId,
        timestamp: profile.updatedAt,
        before,
        after: JSON.parse(JSON.stringify(profile))
      });

      return profile;
    },

    getPropertyBrainCompleteness: (propertyId) => propertyBrainCompleteness(getOrCreatePropertyBrain(propertyId)),

    resolvePropertyPolicy: (input) => {
      const profile = getOrCreatePropertyBrain(input.propertyId);
      const missingFields: string[] = [];
      const sources: Array<{ section: string; confidence: 'high' | 'medium' | 'low' }> = [];
      const styleApplied =
        profile.voiceProfile.tone || profile.voiceProfile.emojiUse
          ? {
              tone: profile.voiceProfile.tone ?? 'neutral',
              emojiUse: profile.voiceProfile.emojiUse ?? 'none'
            }
          : undefined;

      if (profile.escalationMatrix.alwaysManualScenarios.includes(input.intent)) {
        return {
          response: 'This scenario is always manual. Escalate to host/safety workflow immediately.',
          requiresClarification: false,
          missingFields,
          sources: [{ section: 'escalationMatrix', confidence: 'high' }],
          manualOnly: true,
          escalation: { required: true, channel: profile.escalationMatrix.escalationChannel },
          styleApplied
        };
      }

      if (input.intent === 'early-check-in-request') {
        if (!profile.earlyLatePolicy.earlyCheckIn) {
          missingFields.push('earlyLatePolicy.earlyCheckIn');
        }
        if (missingFields.length > 0) {
          return {
            response: 'Need early check-in policy details before sending a deterministic answer.',
            requiresClarification: true,
            missingFields,
            sources,
            styleApplied
          };
        }
        const policy = profile.earlyLatePolicy.earlyCheckIn;
        const firstTier = policy?.priceTiers[0];
        sources.push({ section: 'earlyLatePolicy.earlyCheckIn', confidence: 'high' });
        return {
          response: `Early check-in window is ${policy?.earliestTime}-${policy?.latestTime}. First tier is $${firstTier?.amountUsd ?? 0}.`,
          requiresClarification: false,
          missingFields,
          sources,
          styleApplied
        };
      }

      if (input.intent === 'amenity-issue') {
        if (!input.amenity) {
          missingFields.push('amenity');
          return {
            response: 'Need amenity name to determine incident priority.',
            requiresClarification: true,
            missingFields,
            sources,
            styleApplied
          };
        }
        const priority = profile.amenityImportanceIndex[input.amenity] ?? 'enhancer';
        return {
          response: `Amenity issue on ${input.amenity} should be treated as ${priority} priority.`,
          requiresClarification: false,
          missingFields,
          sources: [{ section: 'amenityImportanceIndex', confidence: 'high' }],
          incidentPriority: priority,
          styleApplied
        };
      }

      if (input.intent === 'parking-help') {
        if (!profile.arrivalGuide.parkingInstructions) {
          missingFields.push('arrivalGuide.parkingInstructions');
          return {
            response: 'Need parking instructions before replying.',
            requiresClarification: true,
            missingFields,
            sources,
            styleApplied
          };
        }
        sources.push({ section: 'arrivalGuide.parkingInstructions', confidence: 'high' });
        return {
          response: `Parking guidance: ${profile.arrivalGuide.parkingInstructions}`,
          requiresClarification: false,
          missingFields,
          sources,
          styleApplied
        };
      }

      if (input.intent === 'amenity-help') {
        if (!input.amenity) {
          missingFields.push('amenity');
          return {
            response: 'Need amenity type to resolve policy.',
            requiresClarification: true,
            missingFields,
            sources,
            styleApplied
          };
        }
        if (input.amenity === 'poolHeating') {
          const policy = profile.amenityPolicies.poolHeating;
          if (!policy) {
            missingFields.push('amenityPolicies.poolHeating');
            return {
              response: 'Pool heating policy is missing.',
              requiresClarification: true,
              missingFields,
              sources,
              styleApplied
            };
          }
          sources.push({ section: 'amenityPolicies.poolHeating', confidence: 'high' });
          return {
            response: `Pool heating is ${policy.available ? 'available' : 'not available'} with caveats: ${policy.caveats.join(', ')}.`,
            requiresClarification: false,
            missingFields,
            sources,
            styleApplied
          };
        }
      }

      if (!profile.coreRules.checkInTime || !profile.coreRules.checkOutTime) {
        missingFields.push('coreRules.checkInTime', 'coreRules.checkOutTime');
        return {
          response: 'Need check-in and check-out policy details before replying.',
          requiresClarification: true,
          missingFields,
          sources,
          styleApplied
        };
      }
      sources.push({ section: 'coreRules', confidence: 'high' });
      return {
        response: `Check-in is at ${profile.coreRules.checkInTime}, check-out is at ${profile.coreRules.checkOutTime}.`,
        requiresClarification: false,
        missingFields,
        sources,
        styleApplied
      };
    },

    getIntentTaxonomy: () => [...messagingIntentV1Taxonomy],

    createIntentDraft: (input) => {
      const actorId = input.actorId ?? 'ai-orchestrator';
      const profile = getOrCreatePropertyBrain(input.propertyId);
      const missingFields: string[] = [];
      const templateSections: string[] = ['greeting', 'policy', 'constraints', 'next-step'];
      const manualOnly = highStakesManualOnlyIntents.has(input.intent);
      const now = nowIso();

      const needsCoreRules =
        input.intent === 'arrival-checkin' ||
        input.intent === 'checkout-guidance' ||
        input.intent === 'rules-acknowledgment' ||
        input.intent === 'booking-inquiry';
      if (needsCoreRules && (!profile.coreRules.checkInTime || !profile.coreRules.checkOutTime || !profile.coreRules.quietHours)) {
        if (!profile.coreRules.checkInTime) {
          missingFields.push('coreRules.checkInTime');
        }
        if (!profile.coreRules.checkOutTime) {
          missingFields.push('coreRules.checkOutTime');
        }
        if (!profile.coreRules.quietHours) {
          missingFields.push('coreRules.quietHours');
        }
      }

      if (input.intent === 'early-check-in-request' && !profile.earlyLatePolicy.earlyCheckIn) {
        missingFields.push('earlyLatePolicy.earlyCheckIn');
      }
      if (input.intent === 'late-checkout-request' && !profile.earlyLatePolicy.lateCheckout) {
        missingFields.push('earlyLatePolicy.lateCheckout');
      }
      if (input.intent === 'pool-help' && !profile.amenityPolicies.poolHeating) {
        missingFields.push('amenityPolicies.poolHeating');
      }
      if (input.intent === 'spa-help' && !profile.amenityPolicies.hotTub) {
        missingFields.push('amenityPolicies.hotTub');
      }
      if (input.intent === 'sauna-help' && !profile.amenityPolicies.sauna) {
        missingFields.push('amenityPolicies.sauna');
      }

      const requiresClarification = missingFields.length > 0;
      const greeting = `Hi ${input.guestName}, thanks for reaching out.`;

      const policyLine = (() => {
        if (requiresClarification) {
          const questions = missingFields
            .map((field) =>
              field === 'earlyLatePolicy.earlyCheckIn'
                ? 'your preferred early check-in time'
                : field === 'earlyLatePolicy.lateCheckout'
                  ? 'your preferred late checkout time'
                  : field.includes('checkInTime')
                    ? 'your arrival timing'
                    : field.includes('checkOutTime')
                      ? 'your checkout timing'
                      : 'a few missing details'
            )
            .join(', ');
          return `Before I confirm details, could you confirm ${questions}?`;
        }

        if (input.intent === 'early-check-in-request') {
          const policy = profile.earlyLatePolicy.earlyCheckIn;
          const firstTier = policy?.priceTiers[0];
          return `Early check-in window is ${policy?.earliestTime}-${policy?.latestTime}. Early access may include a fee (from $${firstTier?.amountUsd ?? 0}).`;
        }
        if (input.intent === 'late-checkout-request') {
          const policy = profile.earlyLatePolicy.lateCheckout;
          const firstTier = policy?.priceTiers[0];
          return `Late checkout window is ${policy?.earliestTime}-${policy?.latestTime}. Late departure may include a fee (from $${firstTier?.amountUsd ?? 0}).`;
        }
        if (input.intent === 'pool-help') {
          const policy = profile.amenityPolicies.poolHeating;
          return `Pool heating is ${policy?.available ? 'available' : 'not available'}${policy?.caveats.length ? ` (${policy.caveats.join(', ')})` : ''}.`;
        }
        if (input.intent === 'spa-help') {
          const policy = profile.amenityPolicies.hotTub;
          return `Spa access is ${policy?.available ? 'available' : 'not available'}${policy?.safetyNotes.length ? ` (${policy.safetyNotes.join(', ')})` : ''}.`;
        }
        if (input.intent === 'sauna-help') {
          const policy = profile.amenityPolicies.sauna;
          return `Sauna is ${policy?.available ? 'available' : 'not available'}${policy?.safetyNotes.length ? ` (${policy.safetyNotes.join(', ')})` : ''}.`;
        }
        if (input.intent === 'rules-acknowledgment') {
          return `Thanks for acknowledging house rules. Quiet hours are ${profile.coreRules.quietHours}.`;
        }
        if (input.intent === 'arrival-checkin') {
          return `Check-in begins at ${profile.coreRules.checkInTime}.`;
        }
        if (input.intent === 'checkout-guidance') {
          return `Checkout is by ${profile.coreRules.checkOutTime}.`;
        }
        if (input.intent === 'booking-inquiry') {
          return `The property supports up to ${profile.coreRules.maxOccupancy ?? 'the posted'} guests.`;
        }
        return policiesByIntent[input.intent] ?? 'Thanks for your message.';
      })();

      const constraintsLine = manualOnly
        ? 'This request is routed to manual host review because it is high-stakes.'
        : 'We will keep this as a draft for host approval before sending.';
      const nextStepLine = requiresClarification
        ? 'Once you confirm, we will finalize the details right away.'
        : 'Let us know if you want us to proceed with this option.';

      const body = [greeting, policyLine, constraintsLine, nextStepLine].join(' ');
      const item: QueueItem = {
        id: nextId(),
        reservationId: input.reservationId,
        intent: input.intent,
        body,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
        sources: [
          {
            type: 'policy',
            label: `${input.intent} deterministic template`,
            snippet: `templateSections=${templateSections.join('|')}`,
            confidence: 'high',
            referenceUrl: `https://docs.walt.local/templates/${input.intent}`,
            referenceId: `template:${input.intent}`
          }
        ],
        auditLog: [
          {
            action: 'created',
            actorId,
            timestamp: now,
            after: {
              mode: 'draft-only',
              manualOnly,
              requiresClarification,
              missingFields,
              templateSections
            }
          }
        ]
      };
      queue.unshift(item);
      emit('draft.created', { id: item.id, intent: item.intent }, { aggregateType: 'draft', aggregateId: item.id, actorId });
      return {
        mode: 'draft-only',
        manualOnly,
        requiresClarification,
        missingFields,
        templateSections,
        item
      };
    },

    getPropertyState: (propertyId) => {
      const openAlerts = monitoringAlerts.filter((alert) => alert.propertyId === propertyId && alert.status === 'open');
      const highSeverityAlerts = openAlerts.filter((alert) => alert.severity === 'high').length;
      const pendingCleanerPings = cleanerJitPings.filter(
        (ping) =>
          propertyIdFromReservation(ping.reservationId) === propertyId &&
          (ping.status === 'requested' || ping.status === 'NOT_READY')
      ).length;
      const vendorConflicts = openAlerts.filter((alert) => alert.category === 'vendor-window').length;
      const maintenanceIssues = incidents.filter(
        (incident) => incident.state !== 'normalized' && incident.summary.toLowerCase().includes('maintenance')
      ).length;
      const criticalAmenityIssues = openAlerts.filter(
        (alert) => alert.category === 'amenity-issue' && alert.severity === 'high'
      ).length;
      const blockers = openAlerts.filter((alert) => alert.severity === 'high').map((alert) => alert.summary);

      const readiness: PropertyReadiness =
        highSeverityAlerts > 0 || pendingCleanerPings > 0 || criticalAmenityIssues > 0
          ? 'blocked'
          : openAlerts.length > 0 || vendorConflicts > 0 || maintenanceIssues > 0
            ? 'at-risk'
            : 'ready';

      return {
        propertyId,
        readiness,
        blockers,
        signals: {
          openAlerts: openAlerts.length,
          highSeverityAlerts,
          pendingCleanerPings,
          vendorConflicts,
          maintenanceIssues,
          criticalAmenityIssues
        },
        updatedAt: nowIso()
      };
    }
  };
};

const singletonStore = createStore();

export const listQueue = () => singletonStore.listQueue();

export const createDraft = (store: Store, input: CreateDraftInput) => store.createDraft(input);
export const editDraft = (store: Store, id: string, body: string, actorId?: string) => store.editDraft(id, body, actorId);
export const approveDraft = (store: Store, id: string, actorId: string) => store.approveDraft(id, actorId);
export const sendDraft = (store: Store, id: string, actorId: string) => store.sendDraft(id, actorId);
export const rejectDraft = (store: Store, id: string, actorId: string) => store.rejectDraft(id, actorId);

export const listEvents = (store: Store) => store.listEvents();
export const listEventRecords = (
  store: Store,
  filters?: { type?: DraftEventType; actorId?: string; limit?: number }
) => store.listEventRecords(filters);
export const listOutboxRecords = (
  store: Store,
  filters?: { destination?: OutboxDestination; status?: OutboxStatus; limit?: number }
) => store.listOutboxRecords(filters);
export const retryOutboxByDestination = (
  store: Store,
  input: { destination: OutboxDestination; limit?: number }
) => store.retryOutboxByDestination(input);
export const getApprovalQueueProjection = (store: Store, limit?: number) => store.getApprovalQueueProjection(limit);
export const getPropertyStateProjection = (store: Store, limit?: number) => store.getPropertyStateProjection(limit);
export const getNormalizedEntities = (
  store: Store,
  kind?: 'properties' | 'guests' | 'reservations' | 'messages' | 'all'
) => store.getNormalizedEntities(kind);
export const getOperationalAwareness = (store: Store) => store.getOperationalAwareness();
export const createIncident = (store: Store, summary: string) => store.createIncident(summary);
export const transitionIncident = (store: Store, id: string, next: IncidentState) =>
  store.transitionIncident(id, next);
export const listIncidents = (store: Store) => store.listIncidents();
export const listCleanerJitPings = (store: Store, reservationId?: string) => store.listCleanerJitPings(reservationId);
export const createCleanerJitPing = (
  store: Store,
  input: { reservationId: string; cleanerId: string; reason: string }
) => store.createCleanerJitPing(input);
export const updateCleanerJitPing = (
  store: Store,
  id: string,
  input: { status: Exclude<CleanerJitStatus, 'requested'>; note?: string; etaMinutes?: number }
) => store.updateCleanerJitPing(id, input);
export const getRolloutState = (store: Store) => store.getRolloutState();
export const completeInternalValidation = (store: Store) => store.completeInternalValidation();
export const onboardHost = (store: Store, hostId: string) => store.onboardHost(hostId);
export const listTrainingSignals = (store: Store) => store.listTrainingSignals();
export const listAuditTimeline = (store: Store, filters?: AuditTimelineFilters) => store.listAuditTimeline(filters);
export const ingestHospitableMessage = (store: Store, input: HospitableMessageInput) =>
  store.ingestHospitableMessage(input);
export const assembleContextByDraftId = (store: Store, draftId: string) => store.assembleContextByDraftId(draftId);
export const regenerateDraftFromInbound = (store: Store, draftId: string) => store.regenerateDraftFromInbound(draftId);
export const recordRefund = (store: Store, amount: number) => store.recordRefund(amount);
export const recordGuestReview = (store: Store, rating: number) => store.recordGuestReview(rating);
export const getRoiMetrics = (store: Store) => store.getRoiMetrics();
export const getTodayPriorities = (store: Store, limit?: number) => store.getTodayPriorities(limit);
export const getProactiveSuggestions = (store: Store, limit?: number) => store.getProactiveSuggestions(limit);
export const listIncidentAlertDrafts = (store: Store) => store.listIncidentAlertDrafts();
export const getPortfolioTrend = (store: Store) => store.getPortfolioTrend();
export const getOperatingProfile = (store: Store) => store.getOperatingProfile();
export const updateOperatingProfile = (
  store: Store,
  input: {
    strictness?: number;
    generosity?: number;
    compensationCapUsd?: number;
    economicSensitivity?: number;
    propertyRiskTolerance?: Record<string, number>;
  }
) => store.updateOperatingProfile(input);
export const assessRiskTrustIntelligence = (
  store: Store,
  input: {
    propertyId: string;
    bookingPatternSignals: number;
    profileQualitySignals: number;
    languageCues: number;
    policyViolationFlags: number;
    positiveReviewHistory: number;
    responseQuality: number;
    explicitRuleAcceptance: number;
  }
) => store.assessRiskTrustIntelligence(input);
export const evaluateAutopilotAction = (
  store: Store,
  input: { reservationId: string; intent: string; body: string }
) => store.evaluateAutopilotAction(input);
export const rollbackAutopilotAction = (store: Store, input: { actionId: string; reason: string }) =>
  store.rollbackAutopilotAction(input);
export const listAutopilotActions = (store: Store) => store.listAutopilotActions();
export const runMonitoringAgents = (store: Store) => store.runMonitoringAgents();
export const listMonitoringAlerts = (
  store: Store,
  filters?: {
    propertyId?: string;
    reservationId?: string;
    status?: MonitoringStatus;
    severity?: MonitoringSeverity;
    category?: MonitoringCategory;
    limit?: number;
  }
) => store.listMonitoringAlerts(filters);
export const getMonitoringAgentStatus = (store: Store) => store.getMonitoringAgentStatus();
export const runJitChecks = (
  store: Store,
  input: { reservationId: string; requestType: 'early-check-in' | 'late-checkout' }
) => store.runJitChecks(input);
export const getIncidentResponsePlan = (store: Store, incidentId: string) => store.getIncidentResponsePlan(incidentId);
export const getIncidentTimeline = (store: Store, incidentId: string) => store.getIncidentTimeline(incidentId);
export const getPropertyState = (store: Store, propertyId: string) => store.getPropertyState(propertyId);
export const getPropertyBrainProfile = (store: Store, propertyId: string) => store.getPropertyBrainProfile(propertyId);
export const updatePropertyBrainProfile = (
  store: Store,
  propertyId: string,
  input: PropertyBrainProfileUpdateInput,
  actorId: string
) => store.updatePropertyBrainProfile(propertyId, input, actorId);
export const getPropertyBrainCompleteness = (store: Store, propertyId: string) =>
  store.getPropertyBrainCompleteness(propertyId);
export const resolvePropertyPolicy = (
  store: Store,
  input: { propertyId: string; intent: string; amenity?: 'poolHeating' | 'hotTub' | 'sauna' | 'wifi' | 'bbq' }
) => store.resolvePropertyPolicy(input);
export const getIntentTaxonomy = (store: Store) => store.getIntentTaxonomy();
export const createIntentDraft = (
  store: Store,
  input: {
    propertyId: string;
    reservationId: string;
    intent: MessagingIntentV1;
    guestName: string;
    actorId?: string;
  }
) => store.createIntentDraft(input);

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

export const getExperienceRiskAssessment = (input: ExperienceRiskInput): ExperienceRiskAssessment => {
  const nightsFactor = Math.min(100, input.nightsRemaining * 10);
  const weighted = Math.round(input.fixImpact * 0.55 + input.guestSensitivity * 0.35 + nightsFactor * 0.1);

  const communicationUrgency: ExperienceRiskAssessment['communicationUrgency'] =
    weighted >= 75 ? 'immediate' : weighted >= 45 ? 'same-day' : 'routine';
  const compensationGuidance: ExperienceRiskAssessment['compensationGuidance'] =
    weighted >= 85 ? 'escalate-review' : weighted >= 55 ? 'consider-credit' : 'no-credit';

  const rationale = [
    `Fix impact contributes ${Math.round(input.fixImpact * 0.55)} points.`,
    `Guest sensitivity contributes ${Math.round(input.guestSensitivity * 0.35)} points.`,
    `Remaining nights contribute ${Math.round(nightsFactor * 0.1)} points.`
  ];

  return {
    score: weighted,
    communicationUrgency,
    compensationGuidance,
    rationale
  };
};

export const createDraftInSingleton = (input: CreateDraftInput) => singletonStore.createDraft(input);
export const editDraftInSingleton = (id: string, body: string, actorId?: string) =>
  singletonStore.editDraft(id, body, actorId);
export const approveDraftInSingleton = (id: string, actorId: string) => singletonStore.approveDraft(id, actorId);
export const sendDraftInSingleton = (id: string, actorId: string) => singletonStore.sendDraft(id, actorId);
export const rejectDraftInSingleton = (id: string, actorId: string) => singletonStore.rejectDraft(id, actorId);
export const listEventsInSingleton = () => singletonStore.listEvents();
export const listEventRecordsInSingleton = (filters?: { type?: DraftEventType; actorId?: string; limit?: number }) =>
  singletonStore.listEventRecords(filters);
export const listOutboxRecordsInSingleton = (filters?: {
  destination?: OutboxDestination;
  status?: OutboxStatus;
  limit?: number;
}) => singletonStore.listOutboxRecords(filters);
export const retryOutboxByDestinationInSingleton = (input: { destination: OutboxDestination; limit?: number }) =>
  singletonStore.retryOutboxByDestination(input);
export const getApprovalQueueProjectionInSingleton = (limit?: number) => singletonStore.getApprovalQueueProjection(limit);
export const getPropertyStateProjectionInSingleton = (limit?: number) => singletonStore.getPropertyStateProjection(limit);
export const getNormalizedEntitiesInSingleton = (
  kind?: 'properties' | 'guests' | 'reservations' | 'messages' | 'all'
) => singletonStore.getNormalizedEntities(kind);
export const getOperationalAwarenessInSingleton = () => singletonStore.getOperationalAwareness();
export const createIncidentInSingleton = (summary: string) => singletonStore.createIncident(summary);
export const transitionIncidentInSingleton = (id: string, next: IncidentState) =>
  singletonStore.transitionIncident(id, next);
export const listIncidentsInSingleton = () => singletonStore.listIncidents();
export const listCleanerJitPingsInSingleton = (reservationId?: string) => singletonStore.listCleanerJitPings(reservationId);
export const createCleanerJitPingInSingleton = (input: { reservationId: string; cleanerId: string; reason: string }) =>
  singletonStore.createCleanerJitPing(input);
export const updateCleanerJitPingInSingleton = (
  id: string,
  input: { status: Exclude<CleanerJitStatus, 'requested'>; note?: string; etaMinutes?: number }
) => singletonStore.updateCleanerJitPing(id, input);
export const getRolloutStateInSingleton = () => singletonStore.getRolloutState();
export const completeInternalValidationInSingleton = () => singletonStore.completeInternalValidation();
export const onboardHostInSingleton = (hostId: string) => singletonStore.onboardHost(hostId);
export const listTrainingSignalsInSingleton = () => singletonStore.listTrainingSignals();
export const listAuditTimelineInSingleton = (filters?: AuditTimelineFilters) => singletonStore.listAuditTimeline(filters);
export const ingestHospitableMessageInSingleton = (input: HospitableMessageInput) =>
  singletonStore.ingestHospitableMessage(input);
export const assembleContextByDraftIdInSingleton = (draftId: string) => singletonStore.assembleContextByDraftId(draftId);
export const regenerateDraftFromInboundInSingleton = (draftId: string) => singletonStore.regenerateDraftFromInbound(draftId);
export const recordRefundInSingleton = (amount: number) => singletonStore.recordRefund(amount);
export const recordGuestReviewInSingleton = (rating: number) => singletonStore.recordGuestReview(rating);
export const getRoiMetricsInSingleton = () => singletonStore.getRoiMetrics();
export const getTodayPrioritiesInSingleton = (limit?: number) => singletonStore.getTodayPriorities(limit);
export const getProactiveSuggestionsInSingleton = (limit?: number) => singletonStore.getProactiveSuggestions(limit);
export const listIncidentAlertDraftsInSingleton = () => singletonStore.listIncidentAlertDrafts();
export const getPortfolioTrendInSingleton = () => singletonStore.getPortfolioTrend();
export const getOperatingProfileInSingleton = () => singletonStore.getOperatingProfile();
export const updateOperatingProfileInSingleton = (input: {
  strictness?: number;
  generosity?: number;
  compensationCapUsd?: number;
  economicSensitivity?: number;
  propertyRiskTolerance?: Record<string, number>;
}) => singletonStore.updateOperatingProfile(input);
export const assessRiskTrustIntelligenceInSingleton = (input: {
  propertyId: string;
  bookingPatternSignals: number;
  profileQualitySignals: number;
  languageCues: number;
  policyViolationFlags: number;
  positiveReviewHistory: number;
  responseQuality: number;
  explicitRuleAcceptance: number;
}) => singletonStore.assessRiskTrustIntelligence(input);
export const evaluateAutopilotActionInSingleton = (input: { reservationId: string; intent: string; body: string }) =>
  singletonStore.evaluateAutopilotAction(input);
export const rollbackAutopilotActionInSingleton = (input: { actionId: string; reason: string }) =>
  singletonStore.rollbackAutopilotAction(input);
export const listAutopilotActionsInSingleton = () => singletonStore.listAutopilotActions();
export const runMonitoringAgentsInSingleton = () => singletonStore.runMonitoringAgents();
export const listMonitoringAlertsInSingleton = (filters?: {
  propertyId?: string;
  reservationId?: string;
  status?: MonitoringStatus;
  severity?: MonitoringSeverity;
  category?: MonitoringCategory;
  limit?: number;
}) => singletonStore.listMonitoringAlerts(filters);
export const getMonitoringAgentStatusInSingleton = () => singletonStore.getMonitoringAgentStatus();
export const runJitChecksInSingleton = (input: { reservationId: string; requestType: 'early-check-in' | 'late-checkout' }) =>
  singletonStore.runJitChecks(input);
export const getIncidentResponsePlanInSingleton = (incidentId: string) => singletonStore.getIncidentResponsePlan(incidentId);
export const getIncidentTimelineInSingleton = (incidentId: string) => singletonStore.getIncidentTimeline(incidentId);
export const getPropertyStateInSingleton = (propertyId: string) => singletonStore.getPropertyState(propertyId);
export const getPropertyBrainProfileInSingleton = (propertyId: string) => singletonStore.getPropertyBrainProfile(propertyId);
export const updatePropertyBrainProfileInSingleton = (
  propertyId: string,
  input: PropertyBrainProfileUpdateInput,
  actorId: string
) => singletonStore.updatePropertyBrainProfile(propertyId, input, actorId);
export const getPropertyBrainCompletenessInSingleton = (propertyId: string) =>
  singletonStore.getPropertyBrainCompleteness(propertyId);
export const resolvePropertyPolicyInSingleton = (input: {
  propertyId: string;
  intent: string;
  amenity?: 'poolHeating' | 'hotTub' | 'sauna' | 'wifi' | 'bbq';
}) => singletonStore.resolvePropertyPolicy(input);
export const getIntentTaxonomyInSingleton = () => singletonStore.getIntentTaxonomy();
export const createIntentDraftInSingleton = (input: {
  propertyId: string;
  reservationId: string;
  intent: MessagingIntentV1;
  guestName: string;
  actorId?: string;
}) => singletonStore.createIntentDraft(input);
