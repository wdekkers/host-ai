'use client';

import { useState } from 'react';

type FormState = 'idle' | 'submitting' | 'success' | 'error' | 'not_found';

export function OptOutForm() {
  const [state, setState] = useState<FormState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState('submitting');

    const phone = new FormData(e.currentTarget).get('phone') as string;

    try {
      const response = await fetch('/api/sms/opt-out', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone, sendConfirmation: true }),
      });

      if (response.ok) {
        setState('success');
      } else if (response.status === 404) {
        setState('not_found');
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
        <p className="text-lg font-medium text-green-800">You&apos;ve been unsubscribed.</p>
        <p className="mt-2 text-sm text-green-700">
          You will no longer receive vendor texts from WALT Services. You may receive a final
          confirmation text. Reply START to re-subscribe at any time.
        </p>
      </div>
    );
  }

  if (state === 'not_found') {
    return (
      <div
        className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-center"
        role="alert"
      >
        <p className="font-medium text-yellow-800">Phone number not found.</p>
        <p className="mt-2 text-sm text-yellow-700">
          No vendor account was found with that phone number. If you believe this is an error,
          contact support@waltservices.com.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
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
        <p className="mt-1.5 text-xs text-gray-500">
          Enter the number that receives WALT Services texts.
        </p>
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
        {state === 'submitting' ? 'Processing…' : 'Unsubscribe from vendor texts'}
      </button>
    </form>
  );
}
