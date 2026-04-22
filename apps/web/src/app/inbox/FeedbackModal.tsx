'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

type Props = {
  reservationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRescored: (score: number, summary: string) => void;
};

export function FeedbackModal({
  reservationId,
  open,
  onOpenChange,
  onRescored,
}: Props): React.JSX.Element {
  const { getToken } = useAuth();
  const [text, setText] = useState('');
  const [target, setTarget] = useState<'rule' | 'guest'>('rule');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(): Promise<void> {
    setSubmitting(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`/api/inbox/${reservationId}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text: text.trim(), target }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: unknown };
        setError(typeof body.error === 'string' ? body.error : 'Failed to save feedback');
        return;
      }
      const body = (await res.json()) as { score: number; summary: string };
      onRescored(body.score, body.summary);
      setText('');
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Give feedback on this score</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="feedback-text">What did the AI miss?</Label>
            <Textarea
              id="feedback-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Guest is pushing for a pet deposit after we said no pets."
              rows={4}
            />
          </div>

          <RadioGroup value={target} onValueChange={(v) => setTarget(v as 'rule' | 'guest')}>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="rule" id="fb-rule" />
              <Label htmlFor="fb-rule">Teach the AI this pattern (applies to all future guests)</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="guest" id="fb-guest" />
              <Label htmlFor="fb-guest">Save as note on this guest only</Label>
            </div>
          </RadioGroup>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={submitting || text.trim().length === 0}>
            {submitting ? 'Saving…' : 'Save & rescore'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
