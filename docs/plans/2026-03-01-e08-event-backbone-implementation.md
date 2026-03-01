# E08 Event Backbone Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement E08 stories for append-only events, outbox retries, projections, audit exportability, and normalized entity views.

**Architecture:** Extend the in-memory command-center store with event/outbox/projection/entity capabilities, then expose them through focused API routes. Keep behavior deterministic and auditable with sequence/timestamps and actor trails.

**Tech Stack:** Next.js route handlers, TypeScript, Node test runner, existing command-center singleton store.

---

### Task 1: Add failing tests for E08 behavior
### Task 2: Implement append-only events + outbox model in store
### Task 3: Implement destination-based outbox retry logic
### Task 4: Implement projections and normalized entities in store
### Task 5: Add new API routes for events/outbox/projections/entities
### Task 6: Extend audit route with export modes and payload inclusion
### Task 7: Add minimal dashboard visibility for new capabilities
### Task 8: Run tests, lint, and typecheck
