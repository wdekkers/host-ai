'use client';

import type { QueueItem } from '@walt/contracts';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';

type QueueResponse = { items: QueueItem[] };

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
  action: 'created' | 'edited' | 'approved' | 'sent';
  actorId: string;
  timestamp: string;
};

type RiskRecommendation = {
  decision: 'accept' | 'review' | 'decline';
  reasons: string[];
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
  sent: '#0ea5e9'
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
  const [awareness, setAwareness] = useState<AwarenessResponse['awareness'] | null>(null);
  const [recentEvents, setRecentEvents] = useState<AwarenessResponse['recentEvents']>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [rollout, setRollout] = useState<RolloutState | null>(null);
  const [trainingSignals, setTrainingSignals] = useState<TrainingSignal[]>([]);
  const [roiMetrics, setRoiMetrics] = useState<RoiMetrics | null>(null);
  const [auditTimeline, setAuditTimeline] = useState<AuditTimelineEntry[]>([]);
  const [auditActorFilter, setAuditActorFilter] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState<'all' | 'created' | 'edited' | 'approved' | 'sent'>(
    'all'
  );
  const [auditSinceFilter, setAuditSinceFilter] = useState('');
  const [auditUntilFilter, setAuditUntilFilter] = useState('');
  const [onboardHostId, setOnboardHostId] = useState('host-001');
  const [roiRefundAmount, setRoiRefundAmount] = useState(25);
  const [roiReviewRating, setRoiReviewRating] = useState(5);
  const [onboardingMessage, setOnboardingMessage] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [incidentSummary, setIncidentSummary] = useState('Pool heat issue on arrival');

  const [riskInputs, setRiskInputs] = useState({
    globalTrustScore: 82,
    localRiskTolerance: 35,
    localIncidentSignals: 2
  });
  const [riskRecommendation, setRiskRecommendation] = useState<RiskRecommendation | null>(null);

  const [strategyInputs, setStrategyInputs] = useState({
    localSeverity: 90,
    portfolioTrend: 'low-risk' as 'low-risk' | 'high-risk',
    portfolioConfidence: 95
  });
  const [strategyRecommendation, setStrategyRecommendation] = useState<StrategyRecommendation | null>(null);

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
      const [queueRes, awarenessRes, incidentsRes, rolloutRes, signalsRes, roiRes, auditRes] = await Promise.all([
        fetch('/api/command-center/queue'),
        fetch('/api/command-center/awareness'),
        fetch('/api/command-center/incidents'),
        fetch('/api/command-center/rollout'),
        fetch('/api/command-center/training-signals'),
        fetch('/api/command-center/roi'),
        fetch('/api/command-center/audit')
      ]);

      const queueData = (await queueRes.json()) as QueueResponse;
      const awarenessData = (await awarenessRes.json()) as AwarenessResponse;
      const incidentsData = (await incidentsRes.json()) as IncidentsResponse;
      const rolloutData = (await rolloutRes.json()) as { rollout: RolloutState };
      const signalsData = (await signalsRes.json()) as { signals: TrainingSignal[] };
      const roiData = (await roiRes.json()) as { metrics: RoiMetrics };
      const auditData = (await auditRes.json()) as { items: AuditTimelineEntry[] };

      setItems(queueData.items ?? []);
      setAwareness(awarenessData.awareness);
      setRecentEvents(awarenessData.recentEvents ?? []);
      setIncidents(incidentsData.items ?? []);
      setRollout(rolloutData.rollout);
      setTrainingSignals(signalsData.signals ?? []);
      setRoiMetrics(roiData.metrics);
      setAuditTimeline(auditData.items ?? []);
    } catch {
      setError('Unable to load command center data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const createDraft = async () => {
    await fetch('/api/command-center/drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reservationId: `res-${Date.now()}`,
        intent: 'check-in-reminder',
        context: { guestName: 'Guest', checkInTime: '4:00 PM' }
      })
    });
    await loadDashboard();
  };

  const updateDraft = async (id: string, action: 'edit' | 'approve' | 'send', body?: string) => {
    await fetch(`/api/command-center/queue/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, actorId: 'host-user', body })
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
    await fetch('/api/command-center/rollout', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'complete-internal-validation' })
    });
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

  return (
    <main style={{ fontFamily: 'system-ui', margin: '2rem', maxWidth: 1180 }}>
      <h1 style={{ marginBottom: '0.5rem' }}>Walt Command Center</h1>
      <p style={{ marginTop: 0, color: '#475569' }}>
        Control tower for communication, operational awareness, risk intelligence, and incident recovery.
      </p>

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

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
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
                setAuditActionFilter(event.target.value as 'all' | 'created' | 'edited' | 'approved' | 'sent')
              }
            >
              <option value="all">all actions</option>
              <option value="created">created</option>
              <option value="edited">edited</option>
              <option value="approved">approved</option>
              <option value="sent">sent</option>
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
        <button onClick={() => void createDraft()} style={buttonStyle('#111827')}>
          Generate AI Draft
        </button>
      </div>

      <h2 style={{ marginBottom: '0.5rem' }}>Approval Queue</h2>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: '#b91c1c' }}>{error}</p>}

      <div style={{ display: 'grid', gap: '1rem' }}>
        {items.map((item) => (
          <QueueCard key={item.id} item={item} onUpdate={updateDraft} />
        ))}
      </div>
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
  onUpdate
}: {
  item: QueueItem;
  onUpdate: (id: string, action: 'edit' | 'approve' | 'send', body?: string) => Promise<void>;
}) {
  const [body, setBody] = useState(item.body);

  return (
    <article style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '1rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <div>
          <strong>{item.intent}</strong>
          <div style={{ fontSize: 12, color: '#64748b' }}>{item.reservationId}</div>
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
            </li>
          ))}
        </ul>
      </div>

      <footer style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
        <button onClick={() => void onUpdate(item.id, 'edit', body)} style={buttonStyle('#334155')}>
          Save Edit
        </button>
        <button onClick={() => void onUpdate(item.id, 'approve')} style={buttonStyle('#166534')}>
          Approve
        </button>
        <button onClick={() => void onUpdate(item.id, 'send')} style={buttonStyle('#0369a1')}>
          Send
        </button>
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
