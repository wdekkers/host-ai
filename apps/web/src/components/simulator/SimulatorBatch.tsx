'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, History, ChevronLeft } from 'lucide-react';
import { QuestionSetManager } from './QuestionSetManager';

interface BatchResult {
  question: string;
  response: string;
  grade: string;
  gradeReason: string;
}

interface BatchSummary {
  good: number;
  incomplete: number;
  noKnowledge: number;
  hallucinated: number;
}

interface Run {
  id: string;
  summary: BatchSummary;
  knowledgeCount: number | null;
  createdAt: string;
}

interface SimulatorBatchProps {
  propertyId: string;
}

const GRADE_COLORS: Record<string, string> = {
  good: 'bg-green-100 text-green-800',
  incomplete: 'bg-amber-100 text-amber-800',
  no_knowledge: 'bg-red-100 text-red-800',
  hallucinated: 'bg-purple-100 text-purple-800',
};

const GRADE_LABELS: Record<string, string> = {
  good: 'Good',
  incomplete: 'Incomplete',
  no_knowledge: 'No Knowledge',
  hallucinated: 'Hallucinated',
};

export function SimulatorBatch({ propertyId }: SimulatorBatchProps) {
  const { getToken } = useAuth();
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Array<{ id: string; question: string }>>([]);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<BatchResult[] | null>(null);
  const [summary, setSummary] = useState<BatchSummary | null>(null);
  const [gradeFilter, setGradeFilter] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [runs, setRuns] = useState<Run[]>([]);
  const [viewingRunId, setViewingRunId] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    const token = await getToken();
    const res = await fetch(`/api/simulator/runs?propertyId=${propertyId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setRuns(data.runs);
    }
  }, [getToken, propertyId]);

  useEffect(() => { void fetchHistory(); }, [fetchHistory]);

  const handleRun = async () => {
    if (!selectedSetId || running) return;
    setRunning(true);
    setResults(null);
    setSummary(null);
    setGradeFilter(null);

    try {
      const token = await getToken();
      const res = await fetch('/api/simulator/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ propertyId, questionSetId: selectedSetId }),
      });

      if (res.ok) {
        const data = await res.json();
        setResults(data.results);
        setSummary(data.summary);
        void fetchHistory();
      }
    } catch {
      // handled by empty results
    }

    setRunning(false);
  };

  const handleViewRun = async (runId: string) => {
    const token = await getToken();
    const res = await fetch(`/api/simulator/runs/${runId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setResults(data.results);
      setSummary(data.summary as BatchSummary);
      setViewingRunId(runId);
      setShowHistory(false);
      setGradeFilter(null);
    }
  };

  const filteredResults = results?.filter(
    (r) => !gradeFilter || r.grade === gradeFilter,
  );

  const total = summary
    ? summary.good + summary.incomplete + summary.noKnowledge + summary.hallucinated
    : 0;

  // History view
  if (showHistory) {
    return (
      <div className="space-y-3">
        <button
          onClick={() => setShowHistory(false)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <h3 className="text-sm font-medium text-gray-900">Run History</h3>
        {runs.length === 0 ? (
          <p className="text-sm text-gray-500">No batch runs yet.</p>
        ) : (
          <div className="space-y-2">
            {runs.map((run) => {
              const t = run.summary.good + run.summary.incomplete + run.summary.noKnowledge + run.summary.hallucinated;
              return (
                <button
                  key={run.id}
                  onClick={() => void handleViewRun(run.id)}
                  className="w-full text-left p-3 rounded-md border border-slate-200 hover:bg-gray-50"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700">
                      {new Date(run.createdAt).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {run.summary.good}/{t} Good
                    </span>
                  </div>
                  <div className="flex gap-2 mt-1">
                    {run.summary.good > 0 && <span className="text-xs text-green-700">{run.summary.good} good</span>}
                    {run.summary.incomplete > 0 && <span className="text-xs text-amber-700">{run.summary.incomplete} incomplete</span>}
                    {run.summary.noKnowledge > 0 && <span className="text-xs text-red-700">{run.summary.noKnowledge} no knowledge</span>}
                    {run.summary.hallucinated > 0 && <span className="text-xs text-purple-700">{run.summary.hallucinated} hallucinated</span>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Batch Test</span>
        <button
          onClick={() => { setShowHistory(true); void fetchHistory(); }}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
        >
          <History className="h-3.5 w-3.5" /> History
        </button>
      </div>

      {/* Question set manager */}
      <QuestionSetManager
        propertyId={propertyId}
        onSelectSet={(id, qs) => { setSelectedSetId(id || null); setQuestions(qs); }}
        selectedSetId={selectedSetId}
      />

      {/* Run button */}
      {selectedSetId && questions.length > 0 && (
        <Button
          onClick={() => void handleRun()}
          disabled={running}
          className="w-full bg-sky-600 hover:bg-sky-700 text-white"
        >
          <Play className="h-4 w-4 mr-1" />
          {running ? `Running ${questions.length} questions...` : `Run all (${questions.length} questions)`}
        </Button>
      )}

      {/* Viewing old run indicator */}
      {viewingRunId && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Viewing past run</span>
          <button
            onClick={() => { setViewingRunId(null); setResults(null); setSummary(null); }}
            className="text-xs text-sky-600 hover:text-sky-700"
          >
            Clear
          </button>
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setGradeFilter(null)}
            className={`text-xs px-2 py-1 rounded-full ${!gradeFilter ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            All ({total})
          </button>
          {summary.good > 0 && (
            <button
              onClick={() => setGradeFilter(gradeFilter === 'good' ? null : 'good')}
              className={`text-xs px-2 py-1 rounded-full ${gradeFilter === 'good' ? 'bg-green-700 text-white' : 'bg-green-100 text-green-800'}`}
            >
              Good ({summary.good})
            </button>
          )}
          {summary.incomplete > 0 && (
            <button
              onClick={() => setGradeFilter(gradeFilter === 'incomplete' ? null : 'incomplete')}
              className={`text-xs px-2 py-1 rounded-full ${gradeFilter === 'incomplete' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800'}`}
            >
              Incomplete ({summary.incomplete})
            </button>
          )}
          {summary.noKnowledge > 0 && (
            <button
              onClick={() => setGradeFilter(gradeFilter === 'no_knowledge' ? null : 'no_knowledge')}
              className={`text-xs px-2 py-1 rounded-full ${gradeFilter === 'no_knowledge' ? 'bg-red-700 text-white' : 'bg-red-100 text-red-800'}`}
            >
              No Knowledge ({summary.noKnowledge})
            </button>
          )}
          {summary.hallucinated > 0 && (
            <button
              onClick={() => setGradeFilter(gradeFilter === 'hallucinated' ? null : 'hallucinated')}
              className={`text-xs px-2 py-1 rounded-full ${gradeFilter === 'hallucinated' ? 'bg-purple-700 text-white' : 'bg-purple-100 text-purple-800'}`}
            >
              Hallucinated ({summary.hallucinated})
            </button>
          )}
        </div>
      )}

      {/* Results */}
      {filteredResults && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredResults.map((r, i) => (
            <Card key={i}>
              <CardContent className="py-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900">{r.question}</p>
                  <Badge className={`text-xs shrink-0 ${GRADE_COLORS[r.grade] ?? ''}`}>
                    {GRADE_LABELS[r.grade] ?? r.grade}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600">{r.response}</p>
                <p className="text-xs text-gray-400 italic">{r.gradeReason}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
