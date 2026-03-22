'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, X } from 'lucide-react';
import { SIMULATOR_TEMPLATES } from '@/lib/simulator-templates';

interface Question {
  id: string;
  question: string;
  sortOrder: number;
}

interface QuestionSet {
  id: string;
  name: string;
  questionCount: number;
}

interface QuestionSetManagerProps {
  propertyId: string;
  onSelectSet: (setId: string, questions: Question[]) => void;
  selectedSetId: string | null;
}

export function QuestionSetManager({
  propertyId,
  onSelectSet,
  selectedSetId,
}: QuestionSetManagerProps) {
  const { getToken } = useAuth();
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');

  const fetchSets = useCallback(async () => {
    const token = await getToken();
    const res = await fetch(`/api/simulator/question-sets?propertyId=${propertyId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setSets(data.questionSets);
    }
    setLoading(false);
  }, [getToken, propertyId]);

  const fetchQuestions = useCallback(async (setId: string) => {
    const token = await getToken();
    const res = await fetch(`/api/simulator/question-sets/${setId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setQuestions(data.questions);
      onSelectSet(setId, data.questions);
    }
  }, [getToken, onSelectSet]);

  useEffect(() => { void fetchSets(); }, [fetchSets]);

  const handleCreateFromTemplate = async (templateName: string, templateQuestions: string[]) => {
    const token = await getToken();
    const res = await fetch('/api/simulator/question-sets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ propertyId, name: templateName, questions: templateQuestions }),
    });
    if (res.ok) {
      const data = await res.json();
      void fetchSets();
      void fetchQuestions(data.id);
      setShowTemplates(false);
    }
  };

  const handleAddQuestion = async () => {
    if (!newQuestion.trim() || !selectedSetId) return;
    const token = await getToken();
    const res = await fetch(`/api/simulator/question-sets/${selectedSetId}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question: newQuestion.trim() }),
    });
    if (res.ok) {
      setNewQuestion('');
      void fetchQuestions(selectedSetId);
    }
  };

  const handleDeleteQuestion = async (qId: string) => {
    if (!selectedSetId) return;
    const token = await getToken();
    await fetch(`/api/simulator/question-sets/${selectedSetId}/questions/${qId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    void fetchQuestions(selectedSetId);
  };

  const handleDeleteSet = async (setId: string) => {
    if (!window.confirm('Delete this question set?')) return;
    const token = await getToken();
    await fetch(`/api/simulator/question-sets/${setId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (selectedSetId === setId) {
      onSelectSet('', []);
      setQuestions([]);
    }
    void fetchSets();
  };

  if (loading) return <p className="text-xs text-gray-500">Loading...</p>;

  return (
    <div className="space-y-3">
      {/* Set selector */}
      <div className="flex items-center gap-2">
        <select
          value={selectedSetId ?? ''}
          onChange={(e) => { if (e.target.value) void fetchQuestions(e.target.value); }}
          className="flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
        >
          <option value="">Select question set...</option>
          {sets.map((s) => (
            <option key={s.id} value={s.id}>{s.name} ({s.questionCount})</option>
          ))}
        </select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowTemplates(!showTemplates)}
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> From template
        </Button>
      </div>

      {/* Template picker */}
      {showTemplates && (
        <div className="border border-slate-200 rounded-md p-2 space-y-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-600">Create from template</span>
            <button onClick={() => setShowTemplates(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {SIMULATOR_TEMPLATES.map((t) => (
            <button
              key={t.name}
              onClick={() => void handleCreateFromTemplate(t.name, t.questions)}
              className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-50 text-gray-700"
            >
              {t.name} ({t.questions.length} questions)
            </button>
          ))}
        </div>
      )}

      {/* Questions list */}
      {selectedSetId && (
        <>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {questions.map((q) => (
              <div key={q.id} className="flex items-center gap-2 group">
                <span className="flex-1 text-sm text-gray-700 truncate">{q.question}</span>
                <button
                  onClick={() => void handleDeleteQuestion(q.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Add question */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleAddQuestion(); }}
              placeholder="Add a question..."
              className="flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleAddQuestion()}
              disabled={!newQuestion.trim()}
            >
              Add
            </Button>
          </div>

          {/* Delete set */}
          <button
            onClick={() => void handleDeleteSet(selectedSetId)}
            className="text-xs text-red-500 hover:text-red-700"
          >
            Delete this question set
          </button>
        </>
      )}
    </div>
  );
}
