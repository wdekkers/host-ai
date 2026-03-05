'use client';

import type { QueueItem } from '@walt/contracts';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { getRiskTrustIndicator } from '@/lib/command-center-store';

type QueueResponse = { items: QueueItem[] };
type LandingResponse = {
  defaultScreen: string;
  queueSummary: { total: number; pending: number; approved: number };
};
type TodayPrioritiesResponse = {
  items: Array<{
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
  }>;
};
type ProactiveSuggestionsResponse = {
  items: Array<{
    kind: 'check-in' | 'first-morning' | 'checkout' | 'heads-up';
    draftId: string;
    reservationId: string;
    intent: string;
    priority: 'high' | 'medium' | 'low';
    reason: string;
    suggestedMessage: string;
  }>;
};
type CleanerJitResponse = {
  items: Array<{
    id: string;
    reservationId: string;
    cleanerId: string;
    reason: string;
    status: 'requested' | 'READY' | 'ETA' | 'NOT_READY';
    note?: string;
    etaMinutes?: number;
    updatedAt: string;
  }>;
};
type MonitoringAlertsResponse = {
  items: Array<{
    id: string;
    propertyId: string;
    reservationId?: string;
    category: 'upcoming-check-in' | 'missing-confirmation' | 'vendor-window' | 'amenity-issue';
    severity: 'low' | 'medium' | 'high';
    status: 'open' | 'acknowledged' | 'resolved';
    summary: string;
    updatedAt: string;
  }>;
};
type IncidentAlertsResponse = {
  items: Array<{
    incidentId: string;
    incidentState: 'active' | 'negotiation' | 'resolution-accepted' | 'recovery-closed' | 'normalized';
    hostAlert: string;
    guestDraft: string;
    urgency: 'immediate' | 'high' | 'normal';
    guestChannel: 'in-app-message';
    hostChannel: 'command-center-alert';
    updatedAt: string;
  }>;
};
type PortfolioTrendsResponse = {
  trends: {
    incidentTrend: 'improving' | 'stable' | 'degrading';
    refundTrend: 'improving' | 'stable' | 'degrading';
    amenityReliability: 'high' | 'medium' | 'low';
    reviewQualityTrend: 'improving' | 'stable' | 'degrading';
    generatedAt: string;
  };
};
type OperatingProfileResponse = {
  profile: {
    strictness: number;
    generosity: number;
    compensationCapUsd: number;
    economicSensitivity: number;
    propertyRiskTolerance: Record<string, number>;
    updatedAt: string;
  };
};

type RiskIntelligenceResponse = {
  assessment: {
    riskScore: number;
    trustScore: number;
    recommendation: 'approve-with-guardrails' | 'manual-review' | 'decline';
    factors: Record<string, number>;
    rationale: string[];
  };
};
type AutopilotActionsResponse = {
  items: Array<{
    id: string;
    reservationId: string;
    intent: string;
    decision: 'auto-allowed' | 'manual-required';
    status: 'executed' | 'manual' | 'rolled_back';
    reason: string;
    rollbackReason?: string;
    updatedAt: string;
  }>;
};
type PropertyStateResponse = {
  state: {
    propertyId: string;
    readiness: 'ready' | 'at-risk' | 'blocked';
    blockers: string[];
    signals: { openAlerts: number; highSeverityAlerts: number; pendingCleanerPings: number };
    updatedAt: string;
  };
};

type OutboxResponse = {
  items: Array<{
    id: string;
    destination: 'audit-log' | 'projection-updater' | 'notifications';
    status: 'pending' | 'retrying' | 'delivered' | 'failed';
    attempts: number;
  }>;
};

type ProjectionsResponse = {
  projection:
    | { kind: 'approval-queue'; total: number; items: Array<{ draftId: string }> }
    | { kind: 'property-state'; total: number; items: Array<{ propertyId: string }> };
};

type EntitiesResponse = {
  entities: {
    properties: Array<{ propertyId: string }>;
    guests: Array<{ guestId: string }>;
    reservations: Array<{ reservationId: string }>;
    messages: Array<{ messageId: string }>;
  };
};

type PropertyOverviewResponse = {
  items: Array<{
    propertyId: string;
    readiness: 'ready' | 'at-risk' | 'blocked';
    blockers: string[];
    pendingCount: number;
    highRiskCount: number;
    updatedAt: string;
  }>;
};

type IntegrationStatusResponse = {
  integrations: {
    hospitable: { inboundChannel: string; status: string; mode: string; outboundApiConfigured?: boolean };
    airbnb: { status: string; mode: string; blocksV1: boolean };
  };
};

type RoiDashboardResponse = {
  metrics: {
    responseTimeMinutes: number;
    throughputPerDay: number;
    incidentRate: number;
    recoveryRate: number;
    refundsAndCompensationUsd: number;
    reviewOutcomeAverage: number;
    cleanerResponseLatencyMinutes: number;
  };
};

type AdoptionMetricsResponse = {
  adoption: {
    commandCenterFirstRate: number;
    reducedAnxietyIndex: number;
    workflowAdoptionRate: number;
    period: string;
  };
};

type TwilioThreadsResponse = {
  opsNumber: string;
  threads: Array<{
    cleanerId: string;
    cleanerPhone: string;
    readinessSignal: string;
    updatedAt: string;
  }>;
};

type HospitableMessagesResponse = {
  source: string;
  count: number;
  items: Array<{
    id: string;
    reservationId: string;
    guestName: string;
    message: string;
    sentAt: string;
  }>;
};

type PropertyBrainProfileResponse = {
  profile: {
    propertyId: string;
    coreRules: { checkInTime?: string; checkOutTime?: string; maxOccupancy?: number; quietHours?: string; houseRules: string[] };
    cleanerPreferences: { channel?: string; contact?: string };
    amenityImportanceIndex?: Record<string, 'critical' | 'important' | 'enhancer'>;
    voiceProfile?: { tone?: string; emojiUse?: string; strictness?: string; apologyStyle?: string };
    escalationMatrix?: { alwaysManualScenarios?: string[]; escalationChannel?: string };
    updatedAt: string;
  };
  completeness: {
    coreRules: boolean;
    earlyLatePolicy: boolean;
    arrivalGuide: boolean;
    cleanerPreferences: boolean;
    amenityPolicies: boolean;
    voiceProfile?: boolean;
    escalationMatrix?: boolean;
  };
};

type AwarenessResponse = {
  awareness: {
    pendingCount: number;
    approvedCount: number;
    sentCount: number;
    lastEventType: string | null;
  };
  recentEvents: Array<{ type: string; timestamp: string }>;
};

type Incident = {
  id: string;
  summary: string;
  state: 'active' | 'negotiation' | 'resolution-accepted' | 'recovery-closed' | 'normalized';
  updatedAt: string;
};

type IncidentsResponse = { items: Incident[] };

type RolloutState = {
  internalOnly: boolean;
  internalValidationComplete: boolean;
  properties: Array<{ propertyId: string; name: string; type: 'STR' | 'MTR' }>;
  onboardedHosts: Array<{ hostId: string; status: 'onboarded'; onboardedAt: string }>;
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

type AuditTimelineEntry = {
  draftId: string;
  reservationId: string;
  intent: string;
  action: 'created' | 'edited' | 'approved' | 'sent' | 'rejected';
  actorId: string;
  timestamp: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
};

type ConversationContext = {
  draftId: string;
  reservationId: string;
  intent: string;
  guestName: string;
  policy: string;
  reviewRequired: boolean;
  knowledgeSources: Array<{
    type: string;
    label: string;
    snippet: string;
    confidence?: 'low' | 'medium' | 'high';
    referenceUrl?: string;
  }>;
};

type RiskRecommendation = {
  decision: 'accept' | 'review' | 'decline';
  reasons: string[];
};
type ExperienceRiskAssessment = {
  score: number;
  communicationUrgency: 'routine' | 'same-day' | 'immediate';
  compensationGuidance: 'no-credit' | 'consider-credit' | 'escalate-review';
  rationale: string[];
};

type StrategyRecommendation = {
  action: 'escalate-now' | 'monitor-tightly' | 'routine-handle';
  primaryDriver: 'local' | 'portfolio';
  note: string;
};

const statusColor: Record<QueueItem['status'], string> = {
  pending: '#f59e0b',
  edited: '#6366f1',
  approved: '#059669',
  sent: '#0ea5e9',
  rejected: '#b91c1c'
};

const nextIncidentState: Record<Incident['state'], Incident['state'] | null> = {
  active: 'negotiation',
  negotiation: 'resolution-accepted',
  'resolution-accepted': 'recovery-closed',
  'recovery-closed': 'normalized',
  normalized: null
};

export function CommandCenterDashboard() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [landing, setLanding] = useState<LandingResponse | null>(null);
  const [todayPriorities, setTodayPriorities] = useState<TodayPrioritiesResponse['items']>([]);
  const [proactiveSuggestions, setProactiveSuggestions] = useState<ProactiveSuggestionsResponse['items']>([]);
  const [cleanerJitPings, setCleanerJitPings] = useState<CleanerJitResponse['items']>([]);
  const [monitoringAlerts, setMonitoringAlerts] = useState<MonitoringAlertsResponse['items']>([]);
  const [incidentAlerts, setIncidentAlerts] = useState<IncidentAlertsResponse['items']>([]);
  const [outboxItems, setOutboxItems] = useState<OutboxResponse['items']>([]);
  const [approvalProjectionTotal, setApprovalProjectionTotal] = useState(0);
  const [propertyProjectionTotal, setPropertyProjectionTotal] = useState(0);
  const [entityCounts, setEntityCounts] = useState({ properties: 0, guests: 0, reservations: 0, messages: 0 });
  const [propertyOverview, setPropertyOverview] = useState<PropertyOverviewResponse['items']>([]);
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatusResponse['integrations'] | null>(null);
  const [roiDashboard, setRoiDashboard] = useState<RoiDashboardResponse['metrics'] | null>(null);
  const [adoptionMetrics, setAdoptionMetrics] = useState<AdoptionMetricsResponse['adoption'] | null>(null);
  const [twilioOpsNumber, setTwilioOpsNumber] = useState('+15550000000');
  const [twilioThreads, setTwilioThreads] = useState<TwilioThreadsResponse['threads']>([]);
  const [twilioCleanerId, setTwilioCleanerId] = useState('cleaner-001');
  const [twilioCleanerPhone, setTwilioCleanerPhone] = useState('+15550001234');
  const [twilioReadinessSignal, setTwilioReadinessSignal] = useState('READY');
  const [hospitableMessages, setHospitableMessages] = useState<HospitableMessagesResponse['items']>([]);
  const [propertyBrainPropertyId, setPropertyBrainPropertyId] = useState('property:res-demo-001');
  const [propertyBrain, setPropertyBrain] = useState<PropertyBrainProfileResponse | null>(null);
  const [riskIntelligence, setRiskIntelligence] = useState<RiskIntelligenceResponse['assessment'] | null>(null);
  const [riskIntelligenceInputs, setRiskIntelligenceInputs] = useState({
    bookingPatternSignals: 55,
    profileQualitySignals: 45,
    languageCues: 50,
    policyViolationFlags: 30,
    positiveReviewHistory: 65,
    responseQuality: 70,
    explicitRuleAcceptance: 75
  });
  const [portfolioTrends, setPortfolioTrends] = useState<PortfolioTrendsResponse['trends'] | null>(null);
  const [operatingProfile, setOperatingProfile] = useState<OperatingProfileResponse['profile'] | null>(null);
  const [autopilotActions, setAutopilotActions] = useState<AutopilotActionsResponse['items']>([]);
  const [selectedPropertyState, setSelectedPropertyState] = useState<PropertyStateResponse['state'] | null>(null);
  const [cleanerPingReservationId, setCleanerPingReservationId] = useState('res-demo-001');
  const [cleanerPingCleanerId, setCleanerPingCleanerId] = useState('cleaner-001');
  const [cleanerPingReason, setCleanerPingReason] = useState('Early check-in request requires readiness confirmation.');
  const [awareness, setAwareness] = useState<AwarenessResponse['awareness'] | null>(null);
  const [recentEvents, setRecentEvents] = useState<AwarenessResponse['recentEvents']>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [rollout, setRollout] = useState<RolloutState | null>(null);
  const [trainingSignals, setTrainingSignals] = useState<TrainingSignal[]>([]);
  const [roiMetrics, setRoiMetrics] = useState<RoiMetrics | null>(null);
  const [auditTimeline, setAuditTimeline] = useState<AuditTimelineEntry[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [selectedContext, setSelectedContext] = useState<ConversationContext | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<AuditTimelineEntry[]>([]);
  const [auditActorFilter, setAuditActorFilter] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState<
    'all' | 'created' | 'edited' | 'approved' | 'sent' | 'rejected'
  >('all');
  const [auditSinceFilter, setAuditSinceFilter] = useState('');
  const [auditUntilFilter, setAuditUntilFilter] = useState('');
  const [onboardHostId, setOnboardHostId] = useState('host-001');
  const [roiRefundAmount, setRoiRefundAmount] = useState(25);
  const [roiReviewRating, setRoiReviewRating] = useState(5);
  const [onboardingMessage, setOnboardingMessage] = useState<string | null>(null);
  const [webhookReservationId, setWebhookReservationId] = useState('res-demo-001');
  const [webhookGuestName, setWebhookGuestName] = useState('Guest');
  const [webhookMessage, setWebhookMessage] = useState('Can we check in early around 1pm?');
  const [queueIntentFilter, setQueueIntentFilter] = useState('all');
  const [queueRiskFilter, setQueueRiskFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [queueTrustFilter, setQueueTrustFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [actionError, setActionError] = useState<string | null>(null);
  const [twilioError, setTwilioError] = useState<string | null>(null);
  const [hospitableMessagesError, setHospitableMessagesError] = useState<string | null>(null);
  const [isReadOnly, setIsReadOnly] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [incidentSummary, setIncidentSummary] = useState('Pool heat issue on arrival');

  const [riskInputs, setRiskInputs] = useState({
    globalTrustScore: 82,
    localRiskTolerance: 35,
    localIncidentSignals: 2
  });
  const [riskRecommendation, setRiskRecommendation] = useState<RiskRecommendation | null>(null);
  const [experienceRiskInputs, setExperienceRiskInputs] = useState({
    fixImpact: 70,
    guestSensitivity: 65,
    nightsRemaining: 2
  });
  const [experienceRiskAssessment, setExperienceRiskAssessment] = useState<ExperienceRiskAssessment | null>(null);

  const [strategyInputs, setStrategyInputs] = useState({
    localSeverity: 90,
    portfolioTrend: 'low-risk' as 'low-risk' | 'high-risk',
    portfolioConfidence: 95
  });
  const [strategyRecommendation, setStrategyRecommendation] = useState<StrategyRecommendation | null>(null);

  const handleAuthStatus = (status: number) => {
    if (status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = '/sign-in';
      }
      return;
    }
    if (status === 403) {
      setIsReadOnly(true);
      setError('You do not have permission for one or more command-center actions.');
    }
  };

  const priorities = useMemo(() => {
    const pending = items.filter((item) => item.status === 'pending' || item.status === 'edited').length;
    const approved = items.filter((item) => item.status === 'approved').length;
    const sentToday = items.filter((item) => item.status === 'sent').length;
    return { pending, approved, sentToday };
  }, [items]);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);

    try {
      const [
        queueRes,
        landingRes,
        awarenessRes,
        incidentsRes,
        rolloutRes,
        signalsRes,
        roiRes,
        auditRes,
        prioritiesRes,
        proactiveRes,
        cleanerJitRes,
        monitoringRes,
        incidentAlertsRes,
        outboxRes,
        approvalProjectionRes,
        propertyProjectionRes,
        entitiesRes,
        propertiesOverviewRes,
        integrationStatusRes,
        roiDashboardRes,
        adoptionMetricsRes,
        twilioThreadsRes,
        propertyBrainRes,
        portfolioTrendsRes,
        operatingProfileRes,
        autopilotActionsRes
      ] =
        await Promise.all([
          fetch(`/api/command-center/queue?${buildQueueFilterQuery(queueIntentFilter, queueRiskFilter, queueTrustFilter)}`),
          fetch('/api/command-center/landing'),
          fetch('/api/command-center/awareness'),
          fetch('/api/command-center/incidents'),
          fetch('/api/command-center/rollout'),
          fetch('/api/command-center/training-signals'),
          fetch('/api/command-center/roi'),
          fetch('/api/command-center/audit'),
          fetch('/api/command-center/priorities?limit=6'),
          fetch('/api/command-center/proactive-suggestions?limit=6'),
          fetch('/api/command-center/cleaner-jit/pings'),
          fetch('/api/command-center/monitoring?limit=8'),
          fetch('/api/command-center/incidents/alerts'),
          fetch('/api/command-center/outbox?limit=10'),
          fetch('/api/command-center/projections?kind=approval-queue&limit=10'),
          fetch('/api/command-center/projections?kind=property-state&limit=10'),
          fetch('/api/command-center/entities?kind=all'),
          fetch('/api/command-center/properties/overview'),
          fetch('/api/integrations/status'),
          fetch('/api/command-center/metrics/roi'),
          fetch('/api/command-center/metrics/adoption'),
          fetch('/api/integrations/twilio/threads'),
          fetch(`/api/command-center/property-brain/${encodeURIComponent(propertyBrainPropertyId)}`),
          fetch('/api/command-center/portfolio-trends'),
          fetch('/api/command-center/operating-profile'),
          fetch('/api/command-center/autopilot')
        ]);

      const responses = [
        queueRes,
        landingRes,
        awarenessRes,
        incidentsRes,
        rolloutRes,
        signalsRes,
        roiRes,
        auditRes,
        prioritiesRes,
        proactiveRes,
        cleanerJitRes,
        monitoringRes,
        incidentAlertsRes,
        outboxRes,
        approvalProjectionRes,
        propertyProjectionRes,
        entitiesRes,
        propertiesOverviewRes,
        integrationStatusRes,
        roiDashboardRes,
        adoptionMetricsRes,
        twilioThreadsRes,
        propertyBrainRes,
        portfolioTrendsRes,
        operatingProfileRes,
        autopilotActionsRes
      ];

      const denied = responses.find((response) => response.status === 401 || response.status === 403);
      if (denied) {
        handleAuthStatus(denied.status);
        return;
      }

      const failed = responses.find((response) => !response.ok);
      if (failed) {
        throw new Error(`Request failed with status ${failed.status}`);
      }

      const queueData = (await queueRes.json()) as QueueResponse;
      const landingData = (await landingRes.json()) as LandingResponse;
      const awarenessData = (await awarenessRes.json()) as AwarenessResponse;
      const incidentsData = (await incidentsRes.json()) as IncidentsResponse;
      const rolloutData = (await rolloutRes.json()) as { rollout: RolloutState };
      const signalsData = (await signalsRes.json()) as { signals: TrainingSignal[] };
      const roiData = (await roiRes.json()) as { metrics: RoiMetrics };
      const auditData = (await auditRes.json()) as { items: AuditTimelineEntry[] };
      const prioritiesData = (await prioritiesRes.json()) as TodayPrioritiesResponse;
      const proactiveData = (await proactiveRes.json()) as ProactiveSuggestionsResponse;
      const cleanerJitData = (await cleanerJitRes.json()) as CleanerJitResponse;
      const monitoringData = (await monitoringRes.json()) as MonitoringAlertsResponse;
      const incidentAlertsData = (await incidentAlertsRes.json()) as IncidentAlertsResponse;
      const outboxData = (await outboxRes.json()) as OutboxResponse;
      const approvalProjectionData = (await approvalProjectionRes.json()) as ProjectionsResponse;
      const propertyProjectionData = (await propertyProjectionRes.json()) as ProjectionsResponse;
      const entitiesData = (await entitiesRes.json()) as EntitiesResponse;
      const propertiesOverviewData = (await propertiesOverviewRes.json()) as PropertyOverviewResponse;
      const integrationStatusData = (await integrationStatusRes.json()) as IntegrationStatusResponse;
      const roiDashboardData = (await roiDashboardRes.json()) as RoiDashboardResponse;
      const adoptionMetricsData = (await adoptionMetricsRes.json()) as AdoptionMetricsResponse;
      const twilioThreadsData = (await twilioThreadsRes.json()) as TwilioThreadsResponse;
      const propertyBrainData = (await propertyBrainRes.json()) as PropertyBrainProfileResponse;
      const portfolioTrendsData = (await portfolioTrendsRes.json()) as PortfolioTrendsResponse;
      const operatingProfileData = (await operatingProfileRes.json()) as OperatingProfileResponse;
      const autopilotActionsData = (await autopilotActionsRes.json()) as AutopilotActionsResponse;

      setItems(queueData.items ?? []);
      setLanding(landingData ?? null);
      setAwareness(awarenessData.awareness);
      setRecentEvents(awarenessData.recentEvents ?? []);
      setIncidents(incidentsData.items ?? []);
      setRollout(rolloutData.rollout);
      setTrainingSignals(signalsData.signals ?? []);
      setRoiMetrics(roiData.metrics);
      setAuditTimeline(auditData.items ?? []);
      setTodayPriorities(prioritiesData.items ?? []);
      setProactiveSuggestions(proactiveData.items ?? []);
      setCleanerJitPings(cleanerJitData.items ?? []);
      setMonitoringAlerts(monitoringData.items ?? []);
      setIncidentAlerts(incidentAlertsData.items ?? []);
      setOutboxItems(outboxData.items ?? []);
      setApprovalProjectionTotal(approvalProjectionData.projection?.total ?? 0);
      setPropertyProjectionTotal(propertyProjectionData.projection?.total ?? 0);
      setEntityCounts({
        properties: entitiesData.entities?.properties?.length ?? 0,
        guests: entitiesData.entities?.guests?.length ?? 0,
        reservations: entitiesData.entities?.reservations?.length ?? 0,
        messages: entitiesData.entities?.messages?.length ?? 0
      });
      setPropertyOverview(propertiesOverviewData.items ?? []);
      setIntegrationStatus(integrationStatusData.integrations ?? null);
      setRoiDashboard(roiDashboardData.metrics ?? null);
      setAdoptionMetrics(adoptionMetricsData.adoption ?? null);
      setTwilioOpsNumber(twilioThreadsData.opsNumber ?? '+15550000000');
      setTwilioThreads(twilioThreadsData.threads ?? []);
      setPropertyBrain(propertyBrainData);
      setPortfolioTrends(portfolioTrendsData.trends ?? null);
      setOperatingProfile(operatingProfileData.profile ?? null);
      setAutopilotActions(autopilotActionsData.items ?? []);
    } catch {
      setError('Unable to load command center data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  useEffect(() => {
    if (items.length === 0) {
      setSelectedDraftId(null);
      setSelectedContext(null);
      setSelectedHistory([]);
      return;
    }

    if (!selectedDraftId || !items.some((item) => item.id === selectedDraftId)) {
      setSelectedDraftId(items[0]?.id ?? null);
    }
  }, [items, selectedDraftId]);

  useEffect(() => {
    if (!selectedDraftId) {
      return;
    }
    void loadConversationDetail(selectedDraftId);
  }, [selectedDraftId]);

  const createDraft = async () => {
    if (isReadOnly) {
      return;
    }
    const response = await fetch('/api/command-center/drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reservationId: `res-${Date.now()}`,
        intent: 'check-in-reminder',
        context: { guestName: 'Guest', checkInTime: '4:00 PM' }
      })
    });
    if (!response.ok) {
      handleAuthStatus(response.status);
      return;
    }
    await loadDashboard();
  };

  const updateDraft = async (id: string, action: 'edit' | 'approve' | 'send' | 'reject', body?: string) => {
    if (isReadOnly) {
      return;
    }
    const response = await fetch(`/api/command-center/queue/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, body })
    });
    if (response.status === 401 || response.status === 403) {
      handleAuthStatus(response.status);
      return;
    }
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      throw new Error(payload.error ?? 'Action failed. Retry or refresh the queue.');
    }
    setActionError(null);
    await loadDashboard();
  };

  const regenerateInboundDraft = async (id: string) => {
    await fetch('/api/command-center/drafts/from-inbound', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ draftId: id })
    });
    await loadDashboard();
  };

  const createIncident = async () => {
    await fetch('/api/command-center/incidents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ summary: incidentSummary })
    });
    await loadDashboard();
  };

  const advanceIncident = async (incident: Incident) => {
    const next = nextIncidentState[incident.state];
    if (!next) {
      return;
    }

    await fetch(`/api/command-center/incidents/${incident.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ next })
    });
    await loadDashboard();
  };

  const evaluateRisk = async () => {
    const response = await fetch('/api/command-center/risk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(riskInputs)
    });
    const data = (await response.json()) as { recommendation: RiskRecommendation };
    setRiskRecommendation(data.recommendation);
  };

  const evaluateStrategy = async () => {
    const response = await fetch('/api/command-center/strategy', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(strategyInputs)
    });
    const data = (await response.json()) as { recommendation: StrategyRecommendation };
    setStrategyRecommendation(data.recommendation);
  };

  const completeValidation = async () => {
    if (isReadOnly) {
      return;
    }
    const response = await fetch('/api/command-center/rollout', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'complete-internal-validation' })
    });
    if (!response.ok) {
      handleAuthStatus(response.status);
      return;
    }
    await loadDashboard();
  };

  const submitOnboarding = async () => {
    const response = await fetch('/api/command-center/onboarding', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hostId: onboardHostId })
    });
    const body = (await response.json()) as { error?: string };
    setOnboardingMessage(response.ok ? `Onboarded ${onboardHostId}` : body.error ?? 'Onboarding failed');
    await loadDashboard();
  };

  const addRefundEvent = async () => {
    await fetch('/api/command-center/roi', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'refund', amount: roiRefundAmount })
    });
    await loadDashboard();
  };

  const addReviewEvent = async () => {
    await fetch('/api/command-center/roi', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'review', rating: roiReviewRating })
    });
    await loadDashboard();
  };

  const loadAuditTimeline = async () => {
    const params = new URLSearchParams();
    if (auditActorFilter.trim().length > 0) {
      params.set('actorId', auditActorFilter.trim());
    }
    if (auditActionFilter !== 'all') {
      params.set('action', auditActionFilter);
    }
    if (auditSinceFilter.length > 0) {
      const iso = toIsoDateTime(auditSinceFilter);
      if (iso) {
        params.set('since', iso);
      }
    }
    if (auditUntilFilter.length > 0) {
      const iso = toIsoDateTime(auditUntilFilter);
      if (iso) {
        params.set('until', iso);
      }
    }

    const response = await fetch(`/api/command-center/audit?${params.toString()}`);
    const data = (await response.json()) as { items: AuditTimelineEntry[] };
    setAuditTimeline(data.items ?? []);
  };

  const ingestHospitableWebhook = async () => {
    await fetch('/api/integrations/hospitable', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt-${Date.now()}`,
        reservationId: webhookReservationId,
        guestName: webhookGuestName,
        message: webhookMessage,
        sentAt: new Date().toISOString()
      })
    });
    await loadDashboard();
  };

  const loadHospitableMessages = async () => {
    const response = await fetch(`/api/integrations/hospitable/messages?reservationId=${encodeURIComponent(webhookReservationId)}&limit=10`);
    const body = (await response.json()) as { error?: string } & Partial<HospitableMessagesResponse>;
    if (!response.ok) {
      setHospitableMessagesError(body.error ?? 'Failed to load Hospitable messages.');
      return;
    }
    setHospitableMessages(body.items ?? []);
    setHospitableMessagesError(null);
  };

  const loadConversationDetail = async (draftId: string) => {
    const [contextRes, historyRes] = await Promise.all([
      fetch(`/api/command-center/context/${draftId}`),
      fetch(`/api/command-center/history/${draftId}`)
    ]);

    const contextData = (await contextRes.json()) as { context?: ConversationContext };
    const historyData = (await historyRes.json()) as { items?: AuditTimelineEntry[] };
    setSelectedContext(contextData.context ?? null);
    setSelectedHistory(historyData.items ?? []);

    if (contextData.context?.reservationId) {
      const propertyId = `property:${contextData.context.reservationId}`;
      const propertyStateRes = await fetch(`/api/command-center/property-state/${encodeURIComponent(propertyId)}`);
      const propertyStateData = (await propertyStateRes.json()) as PropertyStateResponse;
      setSelectedPropertyState(propertyStateData.state ?? null);
    } else {
      setSelectedPropertyState(null);
    }
  };

  const createCleanerPing = async () => {
    await fetch('/api/command-center/cleaner-jit/pings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reservationId: cleanerPingReservationId,
        cleanerId: cleanerPingCleanerId,
        reason: cleanerPingReason
      })
    });
    await loadDashboard();
  };

  const respondCleanerPing = async (id: string, status: 'READY' | 'ETA' | 'NOT_READY') => {
    await fetch(`/api/command-center/cleaner-jit/pings/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        status,
        etaMinutes: status === 'ETA' ? 30 : undefined
      })
    });
    await loadDashboard();
  };

  const runMonitoringAgents = async () => {
    await fetch('/api/command-center/monitoring', { method: 'POST' });
    await loadDashboard();
  };

  const evaluateExperienceRisk = async () => {
    const response = await fetch('/api/command-center/experience-risk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(experienceRiskInputs)
    });
    const data = (await response.json()) as ExperienceRiskAssessment;
    setExperienceRiskAssessment(data);
  };

  const evaluateAutopilot = async () => {
    if (isReadOnly) {
      return;
    }
    const response = await fetch('/api/command-center/autopilot', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reservationId: webhookReservationId,
        intent: 'wifi-help',
        body: webhookMessage
      })
    });
    if (!response.ok) {
      handleAuthStatus(response.status);
      return;
    }
    await loadDashboard();
  };

  const rollbackAutopilot = async (actionId: string) => {
    if (isReadOnly) {
      return;
    }
    const response = await fetch('/api/command-center/autopilot/rollback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actionId, reason: 'Host override from command center' })
    });
    if (!response.ok) {
      handleAuthStatus(response.status);
      return;
    }
    await loadDashboard();
  };

  const updateProfileStrictness = async (strictness: number) => {
    if (isReadOnly) {
      return;
    }
    const response = await fetch('/api/command-center/operating-profile', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ strictness })
    });
    if (!response.ok) {
      handleAuthStatus(response.status);
      return;
    }
    await loadDashboard();
  };

  const evaluateRiskIntelligence = async () => {
    const response = await fetch('/api/command-center/risk-intelligence', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        propertyId: propertyBrainPropertyId,
        ...riskIntelligenceInputs
      })
    });
    const body = (await response.json()) as RiskIntelligenceResponse;
    setRiskIntelligence(body.assessment ?? null);
  };

  const seedPropertyBrain = async () => {
    if (isReadOnly) {
      return;
    }
    const response = await fetch(`/api/command-center/property-brain/${encodeURIComponent(propertyBrainPropertyId)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        coreRules: {
          checkInTime: '16:00',
          checkOutTime: '10:00',
          maxOccupancy: 6,
          quietHours: '22:00-08:00',
          houseRules: ['No events', 'No smoking']
        },
        earlyLatePolicy: {
          earlyCheckIn: {
            earliestTime: '12:00',
            latestTime: '15:00',
            priceTiers: [{ fromHour: 12, toHour: 14, amountUsd: 35 }]
          },
          lateCheckout: {
            earliestTime: '10:00',
            latestTime: '13:00',
            priceTiers: [{ fromHour: 11, toHour: 13, amountUsd: 45 }]
          }
        },
        arrivalGuide: {
          entryMethod: 'smart-lock',
          lockInstructions: 'Use guest code and press Enter.',
          parkingInstructions: 'Use assigned driveway only.'
        },
        cleanerPreferences: {
          channel: 'sms',
          contact: '+1-555-0102',
          requiredFormat: 'READY | ETA:<minutes> | NOT_READY:<reason>',
          escalationAfterMinutes: 15
        },
        amenityPolicies: {
          poolHeating: { available: true, temperatureRangeF: '78-84', leadTimeHours: 4, caveats: ['Weather dependent'] }
        }
      })
    });
    if (!response.ok) {
      handleAuthStatus(response.status);
      return;
    }
    await loadDashboard();
  };

  const upsertTwilioThread = async () => {
    const response = await fetch('/api/integrations/twilio/threads', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        opsNumber: twilioOpsNumber,
        cleanerId: twilioCleanerId,
        cleanerPhone: twilioCleanerPhone,
        readinessSignal: twilioReadinessSignal
      })
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setTwilioError(payload.error ?? 'Unable to update Twilio thread.');
      return;
    }

    const body = (await response.json()) as TwilioThreadsResponse;
    setTwilioOpsNumber(body.opsNumber);
    setTwilioThreads(body.threads);
    setTwilioError(null);
  };

  return (
    <main style={{ fontFamily: 'system-ui', margin: '2rem', maxWidth: 1180 }}>
      <h1 style={{ marginBottom: '0.5rem' }}>Walt Command Center</h1>
      <p style={{ marginTop: 0, color: '#475569' }}>
        Control tower for communication, operational awareness, risk intelligence, and incident recovery.
      </p>

      {landing ? (
        <section style={{ ...panelStyle, marginBottom: '1rem' }}>
          <strong style={{ fontSize: 13 }}>Default Landing:</strong> {landing.defaultScreen}
          <span style={{ marginLeft: '0.75rem', fontSize: 13, color: '#475569' }}>
            Queue {landing.queueSummary.total} total / {landing.queueSummary.pending} pending / {landing.queueSummary.approved}{' '}
            approved
          </span>
        </section>
      ) : null}

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: '0.75rem',
          marginBottom: '1rem'
        }}
      >
        <PriorityCard label="Pending / Edited" value={priorities.pending} />
        <PriorityCard label="Approved" value={priorities.approved} />
        <PriorityCard label="Sent" value={priorities.sentToday} />
      </section>

      <section
        style={{
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
          marginBottom: '1rem',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: '0.6rem'
        }}
      >
        <strong style={{ fontSize: 13 }}>Queue Filters</strong>
        <select value={queueIntentFilter} onChange={(event) => setQueueIntentFilter(event.target.value)}>
          <option value="all">all intents</option>
          <option value="booking-inquiry">booking-inquiry</option>
          <option value="early-check-in-request">early-check-in-request</option>
          <option value="late-checkout-request">late-checkout-request</option>
          <option value="wifi-help">wifi-help</option>
          <option value="parking-help">parking-help</option>
          <option value="guest-message">guest-message</option>
          <option value="check-in-reminder">check-in-reminder</option>
          <option value="first-morning-check">first-morning-check</option>
        </select>
        <select
          value={queueRiskFilter}
          onChange={(event) => setQueueRiskFilter(event.target.value as 'all' | 'low' | 'medium' | 'high')}
        >
          <option value="all">all risk</option>
          <option value="low">low</option>
          <option value="medium">medium</option>
          <option value="high">high</option>
        </select>
        <select
          value={queueTrustFilter}
          onChange={(event) => setQueueTrustFilter(event.target.value as 'all' | 'low' | 'medium' | 'high')}
        >
          <option value="all">all trust</option>
          <option value="low">low</option>
          <option value="medium">medium</option>
          <option value="high">high</option>
        </select>
        <button onClick={() => void loadDashboard()} style={buttonStyle('#334155')}>
          Apply Filters
        </button>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <article style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Hospitable Inbound Webhook</h2>
          <p style={{ margin: '0.2rem 0 0.5rem', color: '#475569', fontSize: 13 }}>
            Simulates inbound guest messages into the command center queue.
          </p>
          <div style={{ display: 'grid', gap: '0.4rem' }}>
            <input
              value={webhookReservationId}
              onChange={(event) => setWebhookReservationId(event.target.value)}
              placeholder="reservation id"
            />
            <input
              value={webhookGuestName}
              onChange={(event) => setWebhookGuestName(event.target.value)}
              placeholder="guest name"
            />
            <textarea
              value={webhookMessage}
              onChange={(event) => setWebhookMessage(event.target.value)}
              rows={2}
              style={{ borderRadius: 6, border: '1px solid #cbd5e1', padding: '0.4rem' }}
            />
            <button onClick={() => void ingestHospitableWebhook()} style={buttonStyle('#1d4ed8')}>
              Ingest Message
            </button>
          </div>
        </article>

        <article style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Operations Awareness</h2>
          {awareness ? (
            <>
              <p style={{ margin: '0.2rem 0' }}>Pending: {awareness.pendingCount}</p>
              <p style={{ margin: '0.2rem 0' }}>Approved: {awareness.approvedCount}</p>
              <p style={{ margin: '0.2rem 0' }}>Sent: {awareness.sentCount}</p>
              <p style={{ margin: '0.2rem 0' }}>Last Event: {awareness.lastEventType ?? 'none'}</p>
              <div style={{ marginTop: '0.5rem' }}>
                <strong style={{ fontSize: 13 }}>Recent Events</strong>
                <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1rem' }}>
                  {recentEvents.map((event, index) => (
                    <li key={`${event.type}-${event.timestamp}-${index}`}>
                      {event.type} ({new Date(event.timestamp).toLocaleTimeString()})
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <p>No awareness data yet.</p>
          )}
        </article>
      </section>

      <section style={{ ...panelStyle, marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Property Overview</h3>
        {propertyOverview.length === 0 ? (
          <p style={{ margin: 0, color: '#64748b' }}>No property overview yet.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: 13 }}>
            {propertyOverview.slice(0, 8).map((property) => (
              <li key={property.propertyId}>
                {property.propertyId} [{property.readiness}] pending={property.pendingCount} high-risk={property.highRiskCount}
                {property.blockers.length > 0 ? ` blockers: ${property.blockers.join('; ')}` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <article style={panelStyle}>
          <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Integration Status</h3>
          {integrationStatus ? (
            <>
              <p style={{ margin: '0.2rem 0', fontSize: 13 }}>
                Hospitable: {integrationStatus.hospitable.status} ({integrationStatus.hospitable.inboundChannel})
              </p>
              <p style={{ margin: '0.2rem 0', fontSize: 13 }}>
                Hospitable outbound API: {integrationStatus.hospitable.outboundApiConfigured ? 'configured' : 'not configured'}
              </p>
              <p style={{ margin: '0.2rem 0', fontSize: 13 }}>
                Airbnb: {integrationStatus.airbnb.status} ({integrationStatus.airbnb.mode})
              </p>
            </>
          ) : (
            <p style={{ margin: 0, color: '#64748b' }}>No integration status loaded.</p>
          )}
        </article>

        <article style={panelStyle}>
          <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>ROI and Adoption</h3>
          {roiDashboard ? (
            <>
              <p style={{ margin: '0.2rem 0', fontSize: 13 }}>
                Response {roiDashboard.responseTimeMinutes}m | Throughput {roiDashboard.throughputPerDay}/day
              </p>
              <p style={{ margin: '0.2rem 0', fontSize: 13 }}>
                Incident {roiDashboard.incidentRate}% | Recovery {roiDashboard.recoveryRate}%
              </p>
              <p style={{ margin: '0.2rem 0', fontSize: 13 }}>
                Refunds/Comp ${roiDashboard.refundsAndCompensationUsd.toFixed(2)} | Cleaner latency{' '}
                {roiDashboard.cleanerResponseLatencyMinutes}m
              </p>
            </>
          ) : null}
          {adoptionMetrics ? (
            <p style={{ margin: '0.35rem 0 0', fontSize: 13, color: '#475569' }}>
              Adoption {adoptionMetrics.workflowAdoptionRate}% | Command-center-first {adoptionMetrics.commandCenterFirstRate}% |
              Anxiety index {adoptionMetrics.reducedAnxietyIndex}
            </p>
          ) : null}
        </article>
      </section>

      <section style={{ ...panelStyle, marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Twilio Ops Threads</h3>
        <p style={{ margin: '0.2rem 0 0.5rem', color: '#475569', fontSize: 13 }}>
          Single ops number plus cleaner 1:1 readiness threads for JIT workflows.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr auto', gap: '0.4rem', marginBottom: '0.5rem' }}>
          <input value={twilioOpsNumber} onChange={(event) => setTwilioOpsNumber(event.target.value)} placeholder="ops number" />
          <input value={twilioCleanerId} onChange={(event) => setTwilioCleanerId(event.target.value)} placeholder="cleaner id" />
          <input
            value={twilioCleanerPhone}
            onChange={(event) => setTwilioCleanerPhone(event.target.value)}
            placeholder="cleaner phone"
          />
          <input
            value={twilioReadinessSignal}
            onChange={(event) => setTwilioReadinessSignal(event.target.value)}
            placeholder="signal e.g. READY / ETA:20 / NOT_READY"
          />
          <button onClick={() => void upsertTwilioThread()} style={buttonStyle('#0f766e')}>
            Upsert
          </button>
        </div>
        {twilioError ? <p style={{ margin: '0 0 0.5rem', color: '#b91c1c', fontSize: 13 }}>{twilioError}</p> : null}
        {twilioThreads.length === 0 ? (
          <p style={{ margin: 0, color: '#64748b' }}>No cleaner threads yet.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: 13 }}>
            {twilioThreads.slice(0, 8).map((thread) => (
              <li key={thread.cleanerId}>
                {thread.cleanerId} ({thread.cleanerPhone}) - {thread.readinessSignal}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ ...panelStyle, marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Hospitable API Messages</h3>
        <p style={{ margin: '0.2rem 0 0.5rem', color: '#475569', fontSize: 13 }}>
          Pulls recent messages from the configured Hospitable API.
        </p>
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' }}>
          <button onClick={() => void loadHospitableMessages()} style={buttonStyle('#334155')}>
            Load Messages
          </button>
        </div>
        {hospitableMessagesError ? <p style={{ margin: '0 0 0.5rem', color: '#b91c1c', fontSize: 13 }}>{hospitableMessagesError}</p> : null}
        {hospitableMessages.length === 0 ? (
          <p style={{ margin: 0, color: '#64748b' }}>No messages loaded.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: 13 }}>
            {hospitableMessages.slice(0, 10).map((message) => (
              <li key={message.id}>
                {message.reservationId} - {message.guestName}: {message.message}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <article style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Event Backbone Snapshot</h2>
          <p style={{ margin: '0.2rem 0', fontSize: 13, color: '#475569' }}>
            Approval projection items: {approvalProjectionTotal}
          </p>
          <p style={{ margin: '0.2rem 0', fontSize: 13, color: '#475569' }}>
            Property projection items: {propertyProjectionTotal}
          </p>
          <p style={{ margin: '0.2rem 0', fontSize: 13, color: '#475569' }}>
            Outbox records: {outboxItems.length}
          </p>
          <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1rem', fontSize: 13 }}>
            {outboxItems.slice(0, 5).map((item) => (
              <li key={item.id}>
                {item.destination} - {item.status} (attempts: {item.attempts})
              </li>
            ))}
          </ul>
        </article>

        <article style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Normalized Entities</h2>
          <p style={{ margin: '0.2rem 0', fontSize: 13, color: '#475569' }}>Properties: {entityCounts.properties}</p>
          <p style={{ margin: '0.2rem 0', fontSize: 13, color: '#475569' }}>Guests: {entityCounts.guests}</p>
          <p style={{ margin: '0.2rem 0', fontSize: 13, color: '#475569' }}>Reservations: {entityCounts.reservations}</p>
          <p style={{ margin: '0.2rem 0', fontSize: 13, color: '#475569' }}>Messages: {entityCounts.messages}</p>
        </article>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <article style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Property Brain</h2>
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' }}>
            <input
              value={propertyBrainPropertyId}
              onChange={(event) => setPropertyBrainPropertyId(event.target.value)}
              placeholder="property id"
            />
            <button onClick={() => void loadDashboard()} style={buttonStyle('#334155')}>
              Load
            </button>
            <button onClick={() => void seedPropertyBrain()} style={buttonStyle('#0f766e')}>
              Seed Template
            </button>
          </div>
          {propertyBrain ? (
            <>
              <p style={{ margin: '0.2rem 0', fontSize: 13, color: '#475569' }}>
                Check-in/out: {propertyBrain.profile.coreRules.checkInTime ?? 'n/a'} /{' '}
                {propertyBrain.profile.coreRules.checkOutTime ?? 'n/a'}
              </p>
              <p style={{ margin: '0.2rem 0', fontSize: 13, color: '#475569' }}>
                Occupancy: {propertyBrain.profile.coreRules.maxOccupancy ?? 'n/a'} | Quiet Hours:{' '}
                {propertyBrain.profile.coreRules.quietHours ?? 'n/a'}
              </p>
              <p style={{ margin: '0.2rem 0', fontSize: 13, color: '#475569' }}>
                Cleaner Contact: {propertyBrain.profile.cleanerPreferences.channel ?? 'n/a'}{' '}
                {propertyBrain.profile.cleanerPreferences.contact ?? ''}
              </p>
              <p style={{ margin: '0.2rem 0', fontSize: 13, color: '#475569' }}>
                Voice: {propertyBrain.profile.voiceProfile?.tone ?? 'n/a'} / emoji {propertyBrain.profile.voiceProfile?.emojiUse ?? 'n/a'}
              </p>
              <p style={{ margin: '0.2rem 0', fontSize: 13, color: '#475569' }}>
                Amenity index entries: {Object.keys(propertyBrain.profile.amenityImportanceIndex ?? {}).length}
              </p>
              <p style={{ margin: '0.2rem 0', fontSize: 13, color: '#475569' }}>
                Always-manual scenarios: {propertyBrain.profile.escalationMatrix?.alwaysManualScenarios?.length ?? 0}
              </p>
              <p style={{ margin: '0.35rem 0 0', fontSize: 13 }}>
                Completeness: core={String(propertyBrain.completeness.coreRules)} early/late=
                {String(propertyBrain.completeness.earlyLatePolicy)} arrival={String(propertyBrain.completeness.arrivalGuide)} voice=
                {String(propertyBrain.completeness.voiceProfile ?? false)} escalation=
                {String(propertyBrain.completeness.escalationMatrix ?? false)}
              </p>
            </>
          ) : (
            <p style={{ margin: 0, color: '#64748b' }}>No property brain loaded.</p>
          )}
        </article>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <article style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Incident Recovery State Machine</h2>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <input
              value={incidentSummary}
              onChange={(event) => setIncidentSummary(event.target.value)}
              style={{ flex: 1, border: '1px solid #cbd5e1', borderRadius: 6, padding: '0.45rem' }}
            />
            <button onClick={() => void createIncident()} style={buttonStyle('#7c3aed')}>
              Create Incident
            </button>
          </div>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {incidents.map((incident) => (
              <div
                key={incident.id}
                style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '0.6rem', fontSize: 14 }}
              >
                <div style={{ fontWeight: 600 }}>{incident.summary}</div>
                <div style={{ color: '#64748b', marginBottom: '0.35rem' }}>{incident.state}</div>
                <button
                  onClick={() => void advanceIncident(incident)}
                  style={buttonStyle('#1d4ed8')}
                  disabled={!nextIncidentState[incident.state]}
                >
                  Advance State
                </button>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <article style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Controlled Rollout</h2>
          {rollout ? (
            <>
              <p style={{ margin: '0.2rem 0' }}>Internal Only: {String(rollout.internalOnly)}</p>
              <p style={{ margin: '0.2rem 0' }}>
                Internal Validation: {rollout.internalValidationComplete ? 'complete' : 'pending'}
              </p>
              <p style={{ margin: '0.2rem 0' }}>Phase: {rollout.phase}</p>
              <p style={{ margin: '0.2rem 0' }}>
                Onboarding Progress: {rollout.onboardedHosts.length}/{rollout.targetHostCount} (
                {rollout.progressPercent}%)
              </p>
              <button
                onClick={() => void completeValidation()}
                style={buttonStyle('#6d28d9')}
                disabled={rollout.internalValidationComplete}
              >
                Complete Internal Validation
              </button>
              <div style={{ marginTop: '0.5rem', fontSize: 13 }}>
                <strong>Initial Cohort</strong>
                <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1rem' }}>
                  {rollout.properties.map((property) => (
                    <li key={property.propertyId}>
                      {property.name} ({property.type})
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <p>Loading rollout state...</p>
          )}
        </article>

        <article style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Host Onboarding</h2>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <input
              value={onboardHostId}
              onChange={(event) => setOnboardHostId(event.target.value)}
              style={{ flex: 1, border: '1px solid #cbd5e1', borderRadius: 6, padding: '0.45rem' }}
            />
            <button onClick={() => void submitOnboarding()} style={buttonStyle('#0f766e')}>
              Onboard Host
            </button>
          </div>
          {onboardingMessage && <p style={{ margin: '0.3rem 0', color: '#475569' }}>{onboardingMessage}</p>}
          <div style={{ fontSize: 13 }}>
            <strong>Onboarded Hosts</strong>
            <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1rem' }}>
              {(rollout?.onboardedHosts ?? []).map((host) => (
                <li key={host.hostId}>{host.hostId}</li>
              ))}
            </ul>
          </div>
        </article>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <article style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Training Signals From Edits</h2>
          <p style={{ margin: '0.2rem 0 0.5rem', color: '#475569', fontSize: 13 }}>
            Capturing host edits for model quality improvement.
          </p>
          <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: 13 }}>
            {trainingSignals.slice(-5).reverse().map((signal, index) => (
              <li key={`${signal.draftId}-${signal.capturedAt}-${index}`}>
                {signal.intent}: {signal.after}
              </li>
            ))}
          </ul>
        </article>

        <article style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Internal ROI Tracking</h2>
          {roiMetrics ? (
            <>
              <p style={{ margin: '0.2rem 0' }}>Messages handled: {roiMetrics.messagesHandled}</p>
              <p style={{ margin: '0.2rem 0' }}>Incidents: {roiMetrics.incidentCount}</p>
              <p style={{ margin: '0.2rem 0' }}>
                Total refunds: ${roiMetrics.totalRefundAmount.toFixed(2)}
              </p>
              <p style={{ margin: '0.2rem 0' }}>Review average: {roiMetrics.reviewAverage.toFixed(2)}</p>
            </>
          ) : (
            <p>No ROI data yet.</p>
          )}
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem' }}>
            <input
              type="number"
              value={roiRefundAmount}
              onChange={(event) => setRoiRefundAmount(Number(event.target.value))}
              style={{ width: 90 }}
            />
            <button onClick={() => void addRefundEvent()} style={buttonStyle('#b45309')}>
              Record Refund
            </button>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
            <input
              type="number"
              min={1}
              max={5}
              value={roiReviewRating}
              onChange={(event) => setRoiReviewRating(Number(event.target.value))}
              style={{ width: 90 }}
            />
            <button onClick={() => void addReviewEvent()} style={buttonStyle('#1d4ed8')}>
              Record Review
            </button>
          </div>
        </article>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <article style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Dedicated Audit Timeline</h2>
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' }}>
            <input
              value={auditActorFilter}
              onChange={(event) => setAuditActorFilter(event.target.value)}
              placeholder="actorId"
              style={{ width: 120 }}
            />
            <select
              value={auditActionFilter}
              onChange={(event) =>
                setAuditActionFilter(
                  event.target.value as 'all' | 'created' | 'edited' | 'approved' | 'sent' | 'rejected'
                )
              }
            >
              <option value="all">all actions</option>
              <option value="created">created</option>
              <option value="edited">edited</option>
              <option value="approved">approved</option>
              <option value="sent">sent</option>
              <option value="rejected">rejected</option>
            </select>
            <input
              type="datetime-local"
              value={auditSinceFilter}
              onChange={(event) => setAuditSinceFilter(event.target.value)}
              style={{ width: 190 }}
            />
            <input
              type="datetime-local"
              value={auditUntilFilter}
              onChange={(event) => setAuditUntilFilter(event.target.value)}
              style={{ width: 190 }}
            />
            <button onClick={() => void loadAuditTimeline()} style={buttonStyle('#334155')}>
              Apply
            </button>
          </div>
          <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: 13, maxHeight: 180, overflow: 'auto' }}>
            {auditTimeline.slice(0, 25).map((entry, index) => (
              <li key={`${entry.draftId}-${entry.timestamp}-${index}`}>
                {entry.action} by {entry.actorId} on {entry.draftId}
                {entry.before || entry.after ? (
                  <span style={{ color: '#64748b' }}>
                    {' '}
                    ({formatAuditPayload(entry.before, entry.after)})
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </article>

        <article style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Risk and Trust Recommendation</h2>
          <Field
            label="Global Trust Score"
            value={riskInputs.globalTrustScore}
            onChange={(value) => setRiskInputs((current) => ({ ...current, globalTrustScore: value }))}
          />
          <Field
            label="Local Risk Tolerance"
            value={riskInputs.localRiskTolerance}
            onChange={(value) => setRiskInputs((current) => ({ ...current, localRiskTolerance: value }))}
          />
          <Field
            label="Local Incident Signals"
            value={riskInputs.localIncidentSignals}
            onChange={(value) => setRiskInputs((current) => ({ ...current, localIncidentSignals: value }))}
          />
          <button onClick={() => void evaluateRisk()} style={buttonStyle('#b45309')}>
            Evaluate Risk
          </button>
          {riskRecommendation && (
            <div style={{ marginTop: '0.6rem' }}>
              <strong>Decision: {riskRecommendation.decision}</strong>
              <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1rem' }}>
                {riskRecommendation.reasons.map((reason, index) => (
                  <li key={`${reason}-${index}`}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
        </article>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <article style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Risk/Trust Intelligence</h2>
          <Field
            label="Booking Pattern Signals"
            value={riskIntelligenceInputs.bookingPatternSignals}
            onChange={(value) => setRiskIntelligenceInputs((current) => ({ ...current, bookingPatternSignals: value }))}
          />
          <Field
            label="Profile Quality Signals"
            value={riskIntelligenceInputs.profileQualitySignals}
            onChange={(value) => setRiskIntelligenceInputs((current) => ({ ...current, profileQualitySignals: value }))}
          />
          <Field
            label="Language Cues"
            value={riskIntelligenceInputs.languageCues}
            onChange={(value) => setRiskIntelligenceInputs((current) => ({ ...current, languageCues: value }))}
          />
          <Field
            label="Policy Violation Flags"
            value={riskIntelligenceInputs.policyViolationFlags}
            onChange={(value) => setRiskIntelligenceInputs((current) => ({ ...current, policyViolationFlags: value }))}
          />
          <button onClick={() => void evaluateRiskIntelligence()} style={buttonStyle('#1d4ed8')}>
            Evaluate Intelligence
          </button>
          {riskIntelligence ? (
            <div style={{ marginTop: '0.6rem', fontSize: 13 }}>
              <p style={{ margin: '0.2rem 0' }}>
                Risk: {riskIntelligence.riskScore} | Trust: {riskIntelligence.trustScore}
              </p>
              <p style={{ margin: '0.2rem 0' }}>Recommendation: {riskIntelligence.recommendation}</p>
              <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1rem' }}>
                {riskIntelligence.rationale.map((line, index) => (
                  <li key={`${line}-${index}`}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </article>

        <article style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Economic Sensitivity</h2>
          <p style={{ margin: '0.2rem 0', color: '#475569', fontSize: 13 }}>
            Tune operating profile economic sensitivity used by risk/trust recommendations.
          </p>
          {operatingProfile ? (
            <>
              <p style={{ margin: '0.2rem 0', fontSize: 13 }}>Current: {operatingProfile.economicSensitivity}</p>
              <input
                type="range"
                min={0}
                max={100}
                value={operatingProfile.economicSensitivity}
                disabled={isReadOnly}
                onChange={(event) => {
                  void fetch('/api/command-center/operating-profile', {
                    method: 'PATCH',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ economicSensitivity: Number(event.target.value) })
                  }).then((response) => {
                    if (!response.ok) {
                      handleAuthStatus(response.status);
                      return;
                    }
                    return loadDashboard();
                  });
                }}
                style={{ width: '100%' }}
              />
            </>
          ) : (
            <p style={{ margin: 0, color: '#64748b' }}>No operating profile loaded.</p>
          )}
        </article>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <article style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Local-first Strategy</h2>
          <Field
            label="Local Severity"
            value={strategyInputs.localSeverity}
            onChange={(value) => setStrategyInputs((current) => ({ ...current, localSeverity: value }))}
          />
          <Field
            label="Portfolio Confidence"
            value={strategyInputs.portfolioConfidence}
            onChange={(value) => setStrategyInputs((current) => ({ ...current, portfolioConfidence: value }))}
          />
          <label style={{ display: 'block', fontSize: 13, color: '#475569', marginBottom: '0.5rem' }}>
            Portfolio Trend
            <select
              value={strategyInputs.portfolioTrend}
              onChange={(event) =>
                setStrategyInputs((current) => ({
                  ...current,
                  portfolioTrend: event.target.value as 'low-risk' | 'high-risk'
                }))
              }
              style={{ marginLeft: '0.5rem' }}
            >
              <option value="low-risk">low-risk</option>
              <option value="high-risk">high-risk</option>
            </select>
          </label>
          <button onClick={() => void evaluateStrategy()} style={buttonStyle('#0f766e')}>
            Evaluate Strategy
          </button>
          {strategyRecommendation && (
            <div style={{ marginTop: '0.6rem' }}>
              <strong>Action: {strategyRecommendation.action}</strong>
              <p style={{ margin: '0.25rem 0 0', color: '#475569' }}>
                Primary Driver: {strategyRecommendation.primaryDriver}
              </p>
              <p style={{ margin: '0.25rem 0 0', color: '#475569' }}>{strategyRecommendation.note}</p>
            </div>
          )}
        </article>
      </section>

      <div style={{ marginBottom: '1rem' }}>
        {!isReadOnly ? (
          <button onClick={() => void createDraft()} style={buttonStyle('#111827')}>
            Generate AI Draft
          </button>
        ) : null}
      </div>

      <h2 style={{ marginBottom: '0.5rem' }}>Approval Queue</h2>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: '#b91c1c' }}>{error}</p>}
      {isReadOnly && <p style={{ color: '#92400e' }}>Read-only mode: you can view data but cannot execute restricted actions.</p>}
      {actionError && <p style={{ color: '#b91c1c' }}>{actionError}</p>}

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <article style={panelStyle}>
          <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Conversation Context</h3>
          {selectedContext ? (
            <>
              {selectedContext.reviewRequired ? (
                <p
                  style={{
                    margin: '0 0 0.5rem',
                    color: '#991b1b',
                    background: '#fee2e2',
                    borderRadius: 6,
                    padding: '0.35rem 0.5rem',
                    fontSize: 13
                  }}
                >
                  Low-confidence sources detected. Manual review recommended.
                </p>
              ) : null}
              <p style={{ margin: '0.2rem 0' }}>Draft: {selectedContext.draftId}</p>
              <p style={{ margin: '0.2rem 0' }}>Reservation: {selectedContext.reservationId}</p>
              <p style={{ margin: '0.2rem 0' }}>Guest: {selectedContext.guestName}</p>
              <p style={{ margin: '0.2rem 0' }}>Intent: {selectedContext.intent}</p>
              <p style={{ margin: '0.2rem 0' }}>Policy: {selectedContext.policy}</p>
              <div style={{ marginTop: '0.5rem', fontSize: 13 }}>
                <strong>Sources</strong>
                <ul style={{ margin: '0.35rem 0 0', paddingLeft: '1rem' }}>
                  {selectedContext.knowledgeSources.map((source, index) => (
                    <li key={`${source.label}-${index}`}>
                      [{source.type}] {source.label}: {source.snippet}
                      {source.confidence ? (
                        <span style={sourceConfidenceStyle(source.confidence)}> {source.confidence}</span>
                      ) : null}
                      {source.referenceUrl ? (
                        <a
                          href={source.referenceUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ marginLeft: '0.35rem', color: '#1d4ed8' }}
                        >
                          source link
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <p>Select a queue item to view context.</p>
          )}
        </article>

        <article style={panelStyle}>
          <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Draft History</h3>
          {selectedHistory.length === 0 ? (
            <p>No history for selected draft yet.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: 13, maxHeight: 230, overflow: 'auto' }}>
              {selectedHistory.map((entry, index) => (
                <li key={`${entry.draftId}-${entry.timestamp}-${index}`}>
                  {new Date(entry.timestamp).toLocaleTimeString()} {entry.action} by {entry.actorId}
                  {entry.before || entry.after ? (
                    <span style={{ color: '#64748b' }}> ({formatAuditPayload(entry.before, entry.after)})</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <div style={{ display: 'grid', gap: '1rem' }}>
        {items.map((item) => (
          <QueueCard
            key={item.id}
            item={item}
            isSelected={item.id === selectedDraftId}
            onSelect={setSelectedDraftId}
            canExecute={!isReadOnly}
            onUpdate={async (id, action, body) => {
              try {
                await updateDraft(id, action, body);
              } catch (actionFailure) {
                setActionError(
                  actionFailure instanceof Error
                    ? `${actionFailure.message} Use "Regenerate AI Draft" or retry after review.`
                    : 'Action failed. Retry or refresh the queue.'
                );
              }
            }}
            onRegenerateInbound={regenerateInboundDraft}
          />
        ))}
      </div>

      <section style={{ ...panelStyle, marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Today&apos;s Priorities</h3>
        {todayPriorities.length === 0 ? (
          <p style={{ margin: 0, color: '#64748b' }}>No actionable priorities right now.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: 13 }}>
            {todayPriorities.map((priority) => (
              <li key={`${priority.draftId}-${priority.updatedAt}`} style={{ marginBottom: '0.4rem' }}>
                <strong>{priority.priority.toUpperCase()}</strong> [{priority.risk}/{priority.trust}] {priority.intent} on{' '}
                {priority.reservationId} ({priority.recommendedAction}) - {priority.reason}{' '}
                <button
                  onClick={() => setSelectedDraftId(priority.draftId)}
                  style={{ ...buttonStyle('#0f172a'), marginLeft: '0.35rem', padding: '0.15rem 0.5rem' }}
                >
                  Open
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ ...panelStyle, marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Proactive Suggestions</h3>
        {proactiveSuggestions.length === 0 ? (
          <p style={{ margin: 0, color: '#64748b' }}>No proactive suggestions at the moment.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: 13 }}>
            {proactiveSuggestions.map((suggestion) => (
              <li key={`${suggestion.draftId}-${suggestion.kind}`} style={{ marginBottom: '0.45rem' }}>
                <strong>{suggestion.kind}</strong> ({suggestion.priority}) for {suggestion.reservationId}: {suggestion.suggestedMessage}
                <div style={{ color: '#64748b' }}>{suggestion.reason}</div>
                <button
                  onClick={() => setSelectedDraftId(suggestion.draftId)}
                  style={{ ...buttonStyle('#0f172a'), marginTop: '0.2rem', padding: '0.15rem 0.5rem' }}
                >
                  Open
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ ...panelStyle, marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Cleaner JIT Pings</h3>
        <div style={{ display: 'grid', gap: '0.35rem', marginBottom: '0.6rem' }}>
          <input
            value={cleanerPingReservationId}
            onChange={(event) => setCleanerPingReservationId(event.target.value)}
            placeholder="reservation id"
          />
          <input
            value={cleanerPingCleanerId}
            onChange={(event) => setCleanerPingCleanerId(event.target.value)}
            placeholder="cleaner id"
          />
          <input value={cleanerPingReason} onChange={(event) => setCleanerPingReason(event.target.value)} placeholder="reason" />
          <button onClick={() => void createCleanerPing()} style={buttonStyle('#475569')}>
            Create JIT Ping
          </button>
        </div>
        {cleanerJitPings.length === 0 ? (
          <p style={{ margin: 0, color: '#64748b' }}>No cleaner pings yet.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: 13 }}>
            {cleanerJitPings.slice(0, 8).map((ping) => (
              <li key={ping.id} style={{ marginBottom: '0.45rem' }}>
                <strong>{ping.reservationId}</strong> [{ping.status}] cleaner={ping.cleanerId}{' '}
                {ping.etaMinutes ? `(ETA ${ping.etaMinutes}m)` : ''} - {ping.reason}
                <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.2rem' }}>
                  <button onClick={() => void respondCleanerPing(ping.id, 'READY')} style={buttonStyle('#166534')}>
                    READY
                  </button>
                  <button onClick={() => void respondCleanerPing(ping.id, 'ETA')} style={buttonStyle('#b45309')}>
                    ETA
                  </button>
                  <button onClick={() => void respondCleanerPing(ping.id, 'NOT_READY')} style={buttonStyle('#b91c1c')}>
                    NOT READY
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ ...panelStyle, marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Monitoring Alerts</h3>
        <button onClick={() => void runMonitoringAgents()} style={{ ...buttonStyle('#334155'), marginBottom: '0.45rem' }}>
          Run Monitoring Sweep
        </button>
        {monitoringAlerts.length === 0 ? (
          <p style={{ margin: 0, color: '#64748b' }}>No monitoring alerts.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: 13 }}>
            {monitoringAlerts.map((alert) => (
              <li key={alert.id}>
                [{alert.severity}] {alert.category} - {alert.summary}
              </li>
            ))}
          </ul>
        )}
        {selectedPropertyState ? (
          <div style={{ marginTop: '0.6rem', fontSize: 13 }}>
            <strong>Property State: {selectedPropertyState.readiness}</strong>
            <div>
              Alerts: {selectedPropertyState.signals.openAlerts}, High: {selectedPropertyState.signals.highSeverityAlerts}, Pending
              cleaner: {selectedPropertyState.signals.pendingCleanerPings}
            </div>
          </div>
        ) : null}
      </section>

      <section style={{ ...panelStyle, marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Incident Host Alerts & Guest Drafts</h3>
        {incidentAlerts.length === 0 ? (
          <p style={{ margin: 0, color: '#64748b' }}>No active incident alerts.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: 13 }}>
            {incidentAlerts.map((alert) => (
              <li key={`${alert.incidentId}-${alert.updatedAt}`} style={{ marginBottom: '0.45rem' }}>
                <strong>[{alert.urgency}] {alert.incidentId}</strong> {alert.hostAlert}
                <div style={{ color: '#64748b', marginTop: '0.15rem' }}>Guest Draft: {alert.guestDraft}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ ...panelStyle, marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Experience Risk Scoring</h3>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginBottom: '0.5rem' }}>
          <Field
            label="Fix Impact"
            value={experienceRiskInputs.fixImpact}
            onChange={(value) => setExperienceRiskInputs((current) => ({ ...current, fixImpact: value }))}
          />
          <Field
            label="Guest Sensitivity"
            value={experienceRiskInputs.guestSensitivity}
            onChange={(value) => setExperienceRiskInputs((current) => ({ ...current, guestSensitivity: value }))}
          />
          <Field
            label="Nights Remaining"
            value={experienceRiskInputs.nightsRemaining}
            onChange={(value) => setExperienceRiskInputs((current) => ({ ...current, nightsRemaining: value }))}
          />
          <button onClick={() => void evaluateExperienceRisk()} style={buttonStyle('#7c2d12')}>
            Score Risk
          </button>
        </div>
        {experienceRiskAssessment ? (
          <p style={{ margin: 0, fontSize: 13 }}>
            Score {experienceRiskAssessment.score} | Urgency {experienceRiskAssessment.communicationUrgency} | Compensation{' '}
            {experienceRiskAssessment.compensationGuidance}
          </p>
        ) : null}
      </section>

      <section style={{ ...panelStyle, marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Portfolio & Autopilot Controls</h3>
        {portfolioTrends ? (
          <p style={{ margin: '0 0 0.45rem', fontSize: 13 }}>
            Incidents: {portfolioTrends.incidentTrend} | Refunds: {portfolioTrends.refundTrend} | Amenity reliability:{' '}
            {portfolioTrends.amenityReliability} | Reviews: {portfolioTrends.reviewQualityTrend}
          </p>
        ) : null}
        {operatingProfile ? (
          <p style={{ margin: '0 0 0.45rem', fontSize: 13 }}>
            Strictness {operatingProfile.strictness} | Generosity {operatingProfile.generosity} | Cap $
            {operatingProfile.compensationCapUsd}
          </p>
        ) : null}
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.4rem' }}>
          {!isReadOnly ? (
            <>
              <button onClick={() => void evaluateAutopilot()} style={buttonStyle('#14532d')}>
                Evaluate Autopilot
              </button>
              <button onClick={() => void updateProfileStrictness(75)} style={buttonStyle('#1e3a8a')}>
                Set Strictness 75
              </button>
            </>
          ) : null}
        </div>
        <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: 13 }}>
          {autopilotActions.slice(0, 5).map((action) => (
            <li key={action.id}>
              {action.intent} [{action.decision}/{action.status}]
              {action.status !== 'rolled_back' ? (
                <button
                  disabled={isReadOnly}
                  onClick={() => void rollbackAutopilot(action.id)}
                  style={{ ...buttonStyle('#991b1b'), marginLeft: '0.35rem', padding: '0.1rem 0.45rem' }}
                >
                  Rollback
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function PriorityCard({ label, value }: { label: string; value: number }) {
  return (
    <article style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.75rem' }}>
      <div style={{ fontSize: 12, color: '#64748b' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
    </article>
  );
}

function QueueCard({
  item,
  isSelected,
  canExecute,
  onSelect,
  onUpdate,
  onRegenerateInbound
}: {
  item: QueueItem;
  isSelected: boolean;
  canExecute: boolean;
  onSelect: (id: string) => void;
  onUpdate: (id: string, action: 'edit' | 'approve' | 'send' | 'reject', body?: string) => Promise<void>;
  onRegenerateInbound: (id: string) => Promise<void>;
}) {
  const [body, setBody] = useState(item.body);
  const riskTrust = getRiskTrustIndicator({ intent: item.intent, body: item.body });

  return (
    <article
      style={{
        border: `1px solid ${isSelected ? '#2563eb' : '#e2e8f0'}`,
        borderRadius: 8,
        padding: '1rem',
        boxShadow: isSelected ? '0 0 0 1px rgba(37, 99, 235, 0.25)' : 'none'
      }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <div>
          <strong>Intent: {item.intent}</strong>
          <div style={{ fontSize: 12, color: '#64748b' }}>{item.reservationId}</div>
          <div style={{ fontSize: 12, color: '#475569' }}>
            Risk: {riskTrust.risk} | Trust: {riskTrust.trust}
          </div>
        </div>
        <span
          style={{
            background: statusColor[item.status],
            color: 'white',
            fontSize: 12,
            borderRadius: 999,
            padding: '0.15rem 0.6rem',
            alignSelf: 'center'
          }}
        >
          {item.status}
        </span>
      </header>

      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={3}
        style={{ width: '100%', borderRadius: 6, border: '1px solid #cbd5e1', padding: '0.5rem' }}
      />

      <div style={{ marginTop: '0.5rem', fontSize: 12, color: '#64748b' }}>
        <strong>Sources</strong>
        <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1rem' }}>
          {item.sources.map((source, idx) => (
            <li key={`${item.id}-${idx}`}>
              {source.label}: {source.snippet}
              {source.confidence ? <span style={sourceConfidenceStyle(source.confidence)}> {source.confidence}</span> : null}
              {source.referenceUrl ? (
                <a href={source.referenceUrl} target="_blank" rel="noreferrer" style={{ marginLeft: '0.35rem', color: '#1d4ed8' }}>
                  source link
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      <div style={{ marginTop: '0.5rem', fontSize: 12, color: '#64748b' }}>
        <strong>Audit Log</strong>
        <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1rem' }}>
          {item.auditLog.map((entry, idx) => (
            <li key={`${item.id}-audit-${idx}`}>
              {entry.action} by {entry.actorId} at {new Date(entry.timestamp).toLocaleTimeString()}
              {entry.before || entry.after ? (
                <span style={{ color: '#64748b' }}> ({formatAuditPayload(entry.before, entry.after)})</span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      <footer style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
        <button onClick={() => onSelect(item.id)} style={buttonStyle('#0f172a')}>
          Open Detail
        </button>
        {canExecute ? (
          <>
            <button onClick={() => void onRegenerateInbound(item.id)} style={buttonStyle('#7c3aed')}>
              Regenerate AI Draft
            </button>
            <button onClick={() => void onUpdate(item.id, 'edit', body)} style={buttonStyle('#334155')}>
              Save Edit
            </button>
            <button onClick={() => void onUpdate(item.id, 'approve')} style={buttonStyle('#166534')}>
              Approve
            </button>
            <button onClick={() => void onUpdate(item.id, 'send')} style={buttonStyle('#0369a1')}>
              Send
            </button>
            <button onClick={() => void onUpdate(item.id, 'reject')} style={buttonStyle('#b91c1c')}>
              Reject
            </button>
          </>
        ) : null}
      </footer>
    </article>
  );
}

function Field({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label style={{ display: 'block', fontSize: 13, color: '#475569', marginBottom: '0.5rem' }}>
      {label}
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ marginLeft: '0.5rem', width: 90 }}
      />
    </label>
  );
}

const panelStyle: CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  padding: '0.85rem'
};

function toIsoDateTime(localDateTime: string): string | null {
  const parsed = new Date(localDateTime);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

function buildQueueFilterQuery(
  intent: string,
  risk: 'all' | 'low' | 'medium' | 'high',
  trust: 'all' | 'low' | 'medium' | 'high'
): string {
  const params = new URLSearchParams();
  if (intent !== 'all') {
    params.set('intent', intent);
  }
  if (risk !== 'all') {
    params.set('risk', risk);
  }
  if (trust !== 'all') {
    params.set('trust', trust);
  }
  return params.toString();
}

function buttonStyle(color: string): CSSProperties {
  return {
    background: color,
    color: 'white',
    border: 0,
    borderRadius: 6,
    padding: '0.45rem 0.75rem',
    cursor: 'pointer'
  };
}

function sourceConfidenceStyle(level: 'low' | 'medium' | 'high'): CSSProperties {
  const color = level === 'high' ? '#065f46' : level === 'medium' ? '#92400e' : '#991b1b';
  const bg = level === 'high' ? '#d1fae5' : level === 'medium' ? '#fef3c7' : '#fee2e2';
  return {
    display: 'inline-block',
    fontSize: 11,
    fontWeight: 600,
    color,
    background: bg,
    borderRadius: 999,
    padding: '0.05rem 0.45rem',
    marginLeft: '0.35rem'
  };
}

function formatAuditPayload(before?: Record<string, unknown>, after?: Record<string, unknown>): string {
  const beforeSummary = before ? `before=${JSON.stringify(before)}` : '';
  const afterSummary = after ? `after=${JSON.stringify(after)}` : '';
  return [beforeSummary, afterSummary].filter((part) => part.length > 0).join(' ');
}
