# Tickets

Simple markdown-based ticket tracking for host-ai.

## Structure

```
tickets/
  open/     ← active tickets
  done/     ← completed tickets (moved here when resolved)
```

## Ticket Format

Each ticket is a markdown file with YAML frontmatter:

```yaml
---
id: "001"
title: Short description
status: open | in-progress | done | blocked
priority: critical | high | medium | low
tags: [tag1, tag2]
created: YYYY-MM-DD
completed: YYYY-MM-DD  # added when moved to done/
assignee: name | unassigned
---
```

## Conventions

- File naming: `{id}-{slug}.md` (e.g., `001-reihub-api-integration.md`)
- IDs are zero-padded sequential numbers
- When a ticket is completed, move it from `open/` to `done/` and set `status: done` + `completed:` date
- Tags should be consistent — reuse existing tags before creating new ones

## Current Tags

| Tag | Description |
|-----|-------------|
| `integration` | Third-party service integration |
| `reihub` | Related to Reihub accounting platform |
| `accounting` | Financial / accounting features |
| `api` | API-related work |
| `ui` | Frontend / UI work |
| `messaging` | Guest messaging pipeline |
| `v1-core` | Required for V1 launch |
| `v1.5` | V1.5 roadmap (proactive ops) |
| `v2` | V2 roadmap (state engine) |
| `v3` | V3 roadmap (portfolio intelligence / autopilot) |
| `command-center` | Main command center UI |
| `pipeline` | End-to-end data/message pipeline |
| `architecture` | Structural / infra changes |
| `events` | Event sourcing / event contracts |
| `contracts` | Shared type contracts |
| `database` | Schema / migration changes |
| `reliability` | System reliability improvements |
| `properties` | Property data model |
| `onboarding` | Property onboarding flow |
| `ai` | AI / LLM related |
| `intents` | Message intent classification |
| `templates` | Draft message templates |
| `ops` | Operations / readiness |
| `proactive` | System-initiated actions |
| `automation` | Autopilot / automated flows |
| `workflow` | Multi-step orchestrated flows |
| `guests` | Guest data / profiles |
| `risk` | Risk assessment |
| `trust` | Trust scoring |
| `safety` | Safety guardrails |
| `escalation` | Escalation rules |
| `settings` | User / org settings |
| `personalization` | Host profile customization |
| `incidents` | Incident tracking |
| `state-machine` | State machine patterns |
| `amenities` | Property amenity management |
| `refactor` | Code refactoring |
| `analytics` | Reporting / metrics |
| `intelligence` | Portfolio intelligence |
| `data` | Data capture / training data |
| `feedback` | Host feedback capture |

## Backlog by Priority

### Critical (do first — V1 core)
| ID | Title |
|----|-------|
| 002 | Build approval queue UI — the command center landing page |
| 003 | Wire end-to-end draft → approve → send pipeline |

### High (do next — V1 foundation)
| ID | Title |
|----|-------|
| 004 | Define event contracts in packages/contracts |
| 005 | Add outbox table for reliable event delivery between services |
| 006 | Add structured onboarding fields to properties table |
| 007 | Expand intent detection to cover all V1 intents |
| 008 | Codify draft message templates with variable injection |

### Medium (V1 polish + V1.5 features)
| ID | Title |
|----|-------|
| 021 | Capture host edit feedback as training data |
| 014 | Implement structured escalation matrix |
| 013 | Implement guest risk/trust scoring visible to host |
| 018 | Extract AI logic into packages/ai shared package |
| 009 | Build "Today's Priorities" problems-first panel |
| 010 | Implement proactive/scheduled message generation |
| 011 | Wire early check-in JIT cleaner workflow end-to-end |
| 012 | Build property state engine (readiness as computed state) |

### Low (V2/V3 features)
| ID | Title |
|----|-------|
| 001 | Investigate Reihub API integration |
| 015 | Add Host Operating Profile (HOP) |
| 016 | Implement incident recovery state machine |
| 017 | Add amenity importance index per property |
| 019 | Build portfolio intelligence and trend analytics |
| 020 | Implement selective autopilot for safe intents |

## Dependency Graph

```
002 (Approval Queue UI)
 └── 003 (Draft → Approve → Send Pipeline)
      ├── 006 (Structured Property Fields)
      ├── 007 (Intent Taxonomy)
      │    └── 008 (Draft Templates)
      ├── 004 (Event Contracts)
      │    └── 005 (Outbox Table)
      └── 021 (Feedback Capture)

009 (Today's Priorities)
 └── 012 (Property State Engine)
      └── 017 (Amenity Importance Index)

010 (Proactive Messages)
 ├── 008 (Draft Templates)
 └── 006 (Structured Property Fields)

011 (Early Check-in JIT Workflow)
 ├── 006 (Structured Property Fields)
 ├── 007 (Intent Taxonomy)
 └── 008 (Draft Templates)

013 (Risk/Trust Scoring) — independent
014 (Escalation Matrix) — independent
 └── 020 (Selective Autopilot)

015 (Host Operating Profile) — independent
016 (Recovery State Machine) — independent
018 (packages/ai extraction) — independent
019 (Portfolio Intelligence) — independent
```
