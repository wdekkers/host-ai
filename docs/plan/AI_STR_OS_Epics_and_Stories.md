# AI STR OS - Epics and Stories

Source: `docs/gpt-planning/AI_STR_OS_Full_Plan_v1.pdf`

## Epic 1: Product North Star and Operating Principles
- Story 1.1: As an operator, I want a control-tower dashboard that shows what matters today so I can prioritize guest communication and operations quickly.
- Story 1.2: As a host, I want AI to draft responses with visible context and sources so I can trust and verify every recommendation.
- Story 1.3: As a host, I want approval/edit/send as the default flow so I stay in control of outbound guest communication.
- Story 1.4: As a platform owner, I want structured policy fields to be the authoritative source so model responses remain consistent and compliant.
- Story 1.5: As an operator, I want event-driven state updates instead of manual checklists so operational awareness is always current.
- Story 1.6: As a host, I want globally portable guest trust and locally configurable risk tolerance so recommendations fit each property.
- Story 1.7: As an operations lead, I want a recovery state machine for incidents so cases close cleanly after accepted resolution.
- Story 1.8: As a portfolio manager, I want local-first decisions with portfolio-informed insights so immediate context and long-term learning both improve outcomes.

## Epic 2: Initial Deployment and Controlled Rollout
- Story 2.1: As the internal team, we want to deploy first across 3 STR + 1 MTR properties so we can validate reliability before external launch.
- Story 2.2: As product leadership, we want host-by-host onboarding after internal validation so risk is controlled during scale-up.
- Story 2.3: As the AI team, we want to capture host edits as training signals so response quality improves with real usage.
- Story 2.4: As leadership, we want internal ROI tracking on response speed, incidents, refunds, and reviews so go/no-go scaling decisions are data-driven.

## Epic 3: V1 Reactive Communication Command Center
- Story 3.1: As a system, I want to ingest guest messages from Hospitable webhooks so inbound communication enters the command center automatically.
- Story 3.2: As an operator, I want intent detection for key hospitality intents so message handling is categorized and prioritized.
- Story 3.3: As AI orchestration, I want per-property context assembly from policies, docs (RAG), and reservation context so drafts are accurate and relevant.
- Story 3.4: As a host, I want each draft to display source references so I can validate why the draft was generated.
- Story 3.5: As a host, I want an approval queue with Preview/Edit/Send so communication can be handled fast with oversight.
- Story 3.6: As compliance, I want full audit logs for draft/edit/send actions so decisions are traceable by actor and timestamp.
- Story 3.7: As a host, I want visible risk/trust indicators on booking requests and inquiries so I can decide with better context.

## Epic 4: V1.5 Proactive Suggestions and Priority Surfacing
- Story 4.1: As an operator, I want suggested proactive messages (check-in, first-morning, checkout, heads-ups) so communication happens before issues escalate.
- Story 4.2: As a host handling early check-in, I want cleaner JIT pings and structured READY/ETA/NOT READY responses so guest expectations are accurate.
- Story 4.3: As a user, I want a Today’s Priorities panel under the queue so operational risks are visible without leaving the main workflow.

## Epic 5: V2 Operations State Engine and Proactive Incident Drafting
- Story 5.1: As operations automation, I want monitoring agents that emit events for upcoming check-ins, confirmations, vendor windows, and amenity issues so risk is detected continuously.
- Story 5.2: As the platform, I want a property state engine that computes readiness and blockers so operational status is explicit and actionable.
- Story 5.3: As a host, I want immediate host alerts for incidents and a drafted guest reassurance message so we respond quickly and appropriately.
- Story 5.4: As an operator, I want experience risk scoring (Fix Impact x Guest Sensitivity) so communication urgency and compensation decisions are separated and rational.

## Epic 6: V3 Portfolio Intelligence and Selective Autopilot
- Story 6.1: As leadership, I want portfolio trends for incidents, refunds, amenity reliability, and response KPIs so we optimize the operating model across properties.
- Story 6.2: As a host, I want selective autopilot only for safe intents (Wi-Fi, parking, basic how-to) so automation scales while limiting risk.
- Story 6.3: As admin, I want rollback and complete logging for any autopilot action so safety and accountability are preserved.
- Story 6.4: As a host, I want operating profile and per-property tolerance settings so AI recommendations match business style and constraints.

## Epic 7: Monorepo and Service Architecture
- Story 7.1: As engineering, we want a monorepo with `apps/web`, `apps/gateway`, domain services, shared packages, and infra so delivery stays consistent and modular.
- Story 7.2: As frontend users, we want a Next.js dashboard focused on approval queue, priorities, and property overview so communication remains the primary workflow.
- Story 7.3: As backend engineering, we want a gateway/BFF for auth, routing, and rate limiting so service access is consistent and secure.
- Story 7.4: As platform engineering, we want dedicated identity, messaging, ops, and notification services so concerns are separated and scalable.
- Story 7.5: As developers, we want shared contracts, DB tooling, AI utilities, and UI packages so cross-service changes remain type-safe and fast.

## Epic 8: Event Backbone, Projections, and Auditability
- Story 8.1: As platform engineering, we want Postgres-first append-only events plus outbox so we keep complexity low while enabling audit and future event-store migration.
- Story 8.2: As backend systems, we want destination-based outbox retries so downstream delivery is reliable.
- Story 8.3: As operations users, we want approval queue and property state projections so UI views are fast and task-focused.
- Story 8.4: As compliance, we want full audit log before/after payloads by actor so critical decisions are reviewable.
- Story 8.5: As data layer, we want normalized properties, guests, reservations, and messages so context retrieval is consistent.

## Epic 9: Property Brain (Structured Knowledge + RAG)
- Story 9.1: As a host, I want onboarding capture for check-in/out, occupancy, quiet hours, and core house rules so policy responses are deterministic.
- Story 9.2: As a host, I want explicit early/late policy rules with pricing tiers and boundaries so AI can answer exceptions correctly.
- Story 9.3: As operations, I want entry, lock, and parking instructions structured so arrival support is accurate.
- Story 9.4: As ops workflow, I want cleaner contact preferences and READY/ETA/NOT READY format stored so JIT readiness checks are usable.
- Story 9.5: As an amenity operator, I want pool heating, spa/hot tub, and sauna policies captured with caveats and safety details so drafts avoid misinformation.
- Story 9.6: As a property manager, I want amenity importance indexing (critical/important/enhancer) so incident priority reflects business impact.
- Story 9.7: As brand management, I want voice profile controls (tone, emoji use, strictness, apology style) so communication stays on-brand.
- Story 9.8: As safety and legal, I want an escalation matrix for always-manual scenarios (refunds, threats, injuries, accusations) so risk handling is controlled.

## Epic 10: Messaging Intent Taxonomy and Guardrails
- Story 10.1: As messaging automation, I want support for v1 intents (booking, rules acknowledgment, arrival/checkout, pool, early/late, spa, sauna) so common workflows are covered.
- Story 10.2: As host safety, I want draft-only defaults with explicit high-stakes manual-only categories so critical outcomes remain human-controlled.
- Story 10.3: As policy enforcement, I want deterministic template sections driven by structured rules so responses are consistent and enforceable.
- Story 10.4: As AI output quality, I want missing required context to trigger clarifying-question drafts so inaccurate responses are prevented.

## Epic 11: Guest Risk and Trust Intelligence
- Story 11.1: As a host, I want a transparent risk/trust model that explains factors and recommendations so I can act confidently.
- Story 11.2: As risk analysis, I want booking pattern signals, profile quality signals, language cues, and policy-violation flags so assessment is comprehensive.
- Story 11.3: As trust analysis, I want positive review history, response quality, and explicit rule acceptance to boost confidence scoring.
- Story 11.4: As host configuration, I want Host Operating Profile tuning (strictness, generosity, compensation, economic sensitivity) so guidance aligns with owner strategy.

## Epic 12: Operations Awareness, Incident Lifecycle, and Recovery
- Story 12.1: As operations, I want readiness computed beyond cleaning (vendor conflicts, maintenance, critical amenities) so guest-impact risk is surfaced early.
- Story 12.2: As v1.5 operations, I want just-in-time checks for early/late requests so intervention is targeted and lightweight.
- Story 12.3: As v2 operations, I want always-on monitoring agents for readiness risk conditions so issues are detected before arrival.
- Story 12.4: As incident response, I want immediate host alerts, approval-gated guest drafts, and separate compensation recommendations so communication and commercial decisions are handled correctly.
- Story 12.5: As system orchestration, I want incident lifecycle states (Active -> Negotiation -> Resolution Accepted -> Recovery Closed -> Normalized) so closure is consistent.

## Epic 13: Command Center UX and Workflow
- Story 13.1: As a host, I want Approval Queue as the default landing screen so communication decisions are the first action every day.
- Story 13.2: As an operator, I want urgency/SLA-based sorting with quick Preview/Edit/Send actions so response times improve.
- Story 13.3: As a host, I want conversation detail with sources, policy references, intent labels, and risk/trust badges so each action is informed.
- Story 13.4: As an operator, I want Today’s Priorities beneath queue and drill-downs to property/reservation details so operational context is one click away.
- Story 13.5: As a manager, I want minimal property overview with readiness snapshot and blockers so portfolio scanning is fast.

## Epic 14: Integrations, Compliance Path, and ROI Metrics
- Story 14.1: As integration engineering, I want Hospitable webhooks as the initial inbound channel so V1 can ship quickly.
- Story 14.2: As product strategy, I want Airbnb API/partner-track work in parallel so long-term integration expands without blocking V1 delivery.
- Story 14.3: As operations comms, I want a single Twilio ops number and cleaner 1:1 threads for structured readiness signals so JIT workflows are reliable.
- Story 14.4: As leadership, I want ROI metrics for response time, throughput, incident/recovery rates, refunds/compensation, review outcomes, and cleaner response latency so value is measurable.
- Story 14.5: As product owner, I want adoption measured by command-center-first behavior and reduced anxiety so early product-market fit is validated internally.
