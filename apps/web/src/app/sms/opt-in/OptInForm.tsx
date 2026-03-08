'use client';

import { useState } from 'react';

import { CONSENT_TEXT_V1 } from '@/lib/consent-text';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

export function OptInForm() {
  const [state, setState] = useState<FormState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState('submitting');
    setErrorMessage('');

    const form = e.currentTarget;
    const data = new FormData(form);

    try {
      const response = await fetch('/api/sms/opt-in', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contactName: data.get('contactName'),
          companyName: data.get('companyName') ?? undefined,
          phone: data.get('phone'),
          checkboxChecked: data.get('checkboxChecked') === 'on',
          sourceUrl: window.location.href,
        }),
      });

      if (response.ok) {
        setState('success');
      } else {
        const err = (await response.json()) as { error?: string };
        setErrorMessage(err.error ?? 'Something went wrong. Please try again.');
        setState('error');
      }
    } catch {
      setErrorMessage('Unable to submit. Please check your connection and try again.');
      setState('error');
    }
  }

  if (state === 'success') {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center" role="status">
        <p className="text-lg font-medium text-green-800">You&apos;re subscribed.</p>
        <p className="mt-2 text-sm text-green-700">
          You&apos;ll receive a confirmation text shortly. Reply STOP at any time to opt out.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div>
        <label htmlFor="contactName" className="mb-1 block text-sm font-medium text-gray-700">
          Contact name{' '}
          <span aria-hidden="true" className="text-red-500">
            *
          </span>
        </label>
        <input
          id="contactName"
          name="contactName"
          type="text"
          required
          autoComplete="name"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500"
        />
      </div>

      <div>
        <label htmlFor="companyName" className="mb-1 block text-sm font-medium text-gray-700">
          Company name <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <input
          id="companyName"
          name="companyName"
          type="text"
          autoComplete="organization"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500"
        />
      </div>

      <div>
        <label htmlFor="phone" className="mb-1 block text-sm font-medium text-gray-700">
          Mobile phone number{' '}
          <span aria-hidden="true" className="text-red-500">
            *
          </span>
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          required
          autoComplete="tel"
          placeholder="+1 (555) 000-0000"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500"
        />
      </div>

      {/* Consent language — shown above the checkbox */}
      <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        {CONSENT_TEXT_V1}
      </div>

      <div className="flex items-start gap-3">
        <input
          id="checkboxChecked"
          name="checkboxChecked"
          type="checkbox"
          required
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-500"
        />
        <label htmlFor="checkboxChecked" className="text-sm text-gray-700">
          I agree to the above terms{' '}
          <span aria-hidden="true" className="text-red-500">
            *
          </span>
        </label>
      </div>

      {state === 'error' && (
        <p className="text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={state === 'submitting'}
        className="w-full rounded-md bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50"
      >
        {state === 'submitting' ? 'Submitting…' : 'Subscribe to vendor texts'}
      </button>
    </form>
  );
}
