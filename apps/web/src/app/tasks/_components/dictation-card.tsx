'use client';

import React, { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Mic, MicOff, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { DictationDraftTask } from '@walt/contracts';
import { useDictation } from './use-dictation';

export function DictationCard({
  onParsed,
}: {
  onParsed: (drafts: DictationDraftTask[]) => void;
}): React.ReactElement {
  const { getToken } = useAuth();
  const dictation = useDictation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function parse(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch('/api/tasks/parse-dictation', {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
        body: JSON.stringify({ transcript: dictation.transcript }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { tasks: DictationDraftTask[] };
      if (data.tasks.length === 0) setError('No tasks detected.');
      else onParsed(data.tasks);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dictate tasks</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          rows={5}
          value={dictation.transcript}
          onChange={(e) => dictation.setTranscript(e.target.value)}
          placeholder="Walk through the property and describe what needs to be done…"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant={dictation.isRecording ? 'destructive' : 'secondary'}
            onClick={() => (dictation.isRecording ? dictation.stop() : void dictation.start())}
          >
            {dictation.isRecording ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
            <span className="ml-2">{dictation.isRecording ? 'Stop' : 'Record'}</span>
          </Button>
          <Button
            type="button"
            onClick={() => void parse()}
            disabled={busy || dictation.transcript.length === 0}
          >
            <Sparkles className="h-4 w-4" />
            <span className="ml-2">{busy ? 'Parsing…' : 'Parse with AI'}</span>
          </Button>
          {(error ?? dictation.error) && (
            <span className="text-sm text-destructive">{error ?? dictation.error}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
