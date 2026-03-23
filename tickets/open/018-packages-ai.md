---
id: "018"
title: Extract AI logic into packages/ai shared package
status: open
priority: medium
tags: [architecture, ai, refactor]
created: 2026-03-21
assignee: unassigned
---

# Extract AI logic into packages/ai shared package

## Summary

Move AI-related logic (prompt templates, context building, RAG helpers, evaluation harness) out of `apps/web/src/lib/` into a dedicated `packages/ai` package so it can be shared across services.

## Context

The plan specifies `packages/ai` for "prompts/tools registry, RAG helpers, evaluation harness." Currently all AI logic lives in `apps/web/src/lib/` (e.g., `generate-reply-suggestion.ts`, `classify-message.ts`), which couples it to the Next.js app and prevents other services from using it.

## What to Extract

- `generateReplySuggestion()` → `packages/ai/src/draft-generator.ts`
- `classify-message.ts` → `packages/ai/src/classifier.ts`
- Knowledge resolution logic → `packages/ai/src/knowledge-resolver.ts`
- Prompt templates → `packages/ai/src/prompts/`
- Draft templates (ticket #008) → `packages/ai/src/templates/`
- Evaluation/grading logic (from simulator) → `packages/ai/src/evaluation/`

## Requirements

- Clean package boundary: `packages/ai` depends on `packages/db` and `packages/contracts` only
- Export typed functions that services can import
- No Next.js or React dependencies in the package
- Services can call AI functions without going through the web app

## Acceptance Criteria

- [ ] `packages/ai` package created with proper tsconfig and exports
- [ ] Core AI functions extracted and working from the package
- [ ] `apps/web` imports from `@walt/ai` instead of local lib
- [ ] Other services can import and use AI functions
- [ ] No functionality regression

## References

- Planning doc: AI_STR_OS_Full_Plan_v1.pdf — Section 4 (packages/ai)
