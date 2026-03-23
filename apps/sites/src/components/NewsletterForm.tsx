'use client';

import { useState } from 'react';
import { z } from 'zod';

const newsletterSchema = z.object({
  email: z.string().email('Use a valid email.'),
});

type NewsletterFields = z.infer<typeof newsletterSchema>;

const emptyForm: NewsletterFields = {
  email: '',
};

export default function NewsletterForm(): React.ReactNode {
  const [values, setValues] = useState<NewsletterFields>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'sent'>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    const result = newsletterSchema.safeParse(values);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Invalid email.');
      setStatus('idle');
      return;
    }
    setIsSubmitting(true);
    setError(null);

    const response = await fetch('/api/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: values.email }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      setError(payload.message ?? 'Unable to subscribe.');
      setStatus('idle');
      setIsSubmitting(false);
      return;
    }

    setStatus('sent');
    setIsSubmitting(false);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 sm:flex-row sm:items-center"
    >
      <input
        className="w-full flex-1 rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/60 focus:outline-none"
        value={values.email}
        onChange={(event) => setValues({ email: event.target.value })}
        placeholder="you@email.com"
        type="email"
        disabled={isSubmitting || status === 'sent'}
      />
      <button
        type="submit"
        className="rounded-full border border-white/30 bg-white/10 px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:-translate-y-0.5 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isSubmitting || status === 'sent'}
      >
        {status === 'sent'
          ? "You're in"
          : isSubmitting
            ? 'Submitting...'
            : 'Get updates'}
      </button>
      {error && <p className="text-xs text-red-300">{error}</p>}
    </form>
  );
}
