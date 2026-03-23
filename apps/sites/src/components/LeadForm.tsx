'use client';

import { useRef, useState } from 'react';
import { z } from 'zod';

const phoneSchema = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  z
    .string()
    .optional()
    .refine(
      (value) => {
        if (!value) return true;
        const digits = value.replace(/\D/g, '');
        return /^[0-9+().\-\s]+$/.test(value) && digits.length >= 7;
      },
      { message: 'Use a valid phone number.' },
    ),
);

const leadSchema = z.object({
  name: z.string().min(2, 'Tell us your name.'),
  email: z.string().email('Use a valid email.'),
  phone: phoneSchema,
  message: z.string().min(3, 'Add your preferred dates and details.'),
  website: z.string().optional(),
});

type LeadFields = z.infer<typeof leadSchema>;

const emptyForm: LeadFields = {
  name: '',
  email: '',
  phone: '',
  message: '',
  website: '',
};

export default function LeadForm(): React.ReactNode {
  const formRef = useRef<HTMLFormElement | null>(null);
  const formStartedAtRef = useRef(Date.now());
  const [values, setValues] = useState<LeadFields>(emptyForm);
  const [errors, setErrors] = useState<
    Partial<Record<keyof LeadFields, string>>
  >({});
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle');

  const handleChange = (field: keyof LeadFields, value: string): void => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const result = leadSchema.safeParse(values);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof LeadFields, string>> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof LeadFields | undefined;
        if (key) {
          fieldErrors[key] = issue.message;
        }
      }
      setErrors(fieldErrors);
      setStatus('idle');
      return;
    }
    setErrors({});
    fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: values.name,
        email: values.email,
        phone: values.phone,
        message: values.message,
        website: values.website,
        formStartedAt: formStartedAtRef.current,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Request failed.');
        }
        setStatus('sent');
        setValues(emptyForm);
        formStartedAtRef.current = Date.now();
      })
      .catch(() => setStatus('error'));
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="grid gap-4 rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-sm backdrop-blur"
    >
      <input
        className="hidden"
        autoComplete="off"
        tabIndex={-1}
        value={values.website}
        onChange={(event) => handleChange('website', event.target.value)}
        name="website"
      />
      <div className="space-y-1">
        <label className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500">
          Name
        </label>
        <input
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none"
          style={{ borderColor: undefined }}
          value={values.name}
          onChange={(event) => handleChange('name', event.target.value)}
          placeholder="Your name"
        />
        {errors.name && (
          <p className="text-xs text-red-500">{errors.name}</p>
        )}
      </div>
      <div className="space-y-1">
        <label className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500">
          Email
        </label>
        <input
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none"
          value={values.email}
          onChange={(event) => handleChange('email', event.target.value)}
          placeholder="you@email.com"
          type="email"
        />
        {errors.email && (
          <p className="text-xs text-red-500">{errors.email}</p>
        )}
      </div>
      <div className="space-y-1">
        <label className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500">
          Phone (optional)
        </label>
        <input
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none"
          value={values.phone ?? ''}
          onChange={(event) => handleChange('phone', event.target.value)}
          placeholder="(555) 123-4567"
          type="tel"
        />
        {errors.phone && (
          <p className="text-xs text-red-500">{errors.phone}</p>
        )}
      </div>
      <div className="space-y-1">
        <label className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500">
          Message
        </label>
        <textarea
          className="min-h-[120px] w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none"
          value={values.message}
          onChange={(event) => handleChange('message', event.target.value)}
          placeholder="Preferred dates, guest count, and any questions."
        />
        {errors.message && (
          <p className="text-xs text-red-500">{errors.message}</p>
        )}
      </div>
      <button
        type="submit"
        className="mt-2 rounded-full px-6 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-white transition hover:-translate-y-0.5"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        {status === 'sent' ? 'Request received' : 'Request availability'}
      </button>
      {status === 'error' ? (
        <p className="text-xs text-red-500">
          Something went wrong. Please try again in a moment.
        </p>
      ) : null}
      <p className="text-xs text-gray-500">
        We follow up within 24 hours with availability and custom add-ons.
      </p>
    </form>
  );
}
