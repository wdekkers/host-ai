CREATE TABLE IF NOT EXISTS walt.simulator_question_sets (
  id UUID PRIMARY KEY,
  organization_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS simulator_question_sets_org_property_idx
  ON walt.simulator_question_sets (organization_id, property_id);

CREATE TABLE IF NOT EXISTS walt.simulator_questions (
  id UUID PRIMARY KEY,
  question_set_id UUID NOT NULL,
  question TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS simulator_questions_set_id_idx
  ON walt.simulator_questions (question_set_id);

CREATE TABLE IF NOT EXISTS walt.simulator_runs (
  id UUID PRIMARY KEY,
  organization_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  question_set_id UUID NOT NULL,
  summary JSONB NOT NULL,
  agent_config_snapshot JSONB,
  knowledge_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS simulator_runs_property_created_idx
  ON walt.simulator_runs (property_id, created_at);

CREATE TABLE IF NOT EXISTS walt.simulator_results (
  id UUID PRIMARY KEY,
  run_id UUID NOT NULL,
  question TEXT NOT NULL,
  response TEXT NOT NULL,
  grade TEXT NOT NULL,
  grade_reason TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS simulator_results_run_id_idx
  ON walt.simulator_results (run_id);
