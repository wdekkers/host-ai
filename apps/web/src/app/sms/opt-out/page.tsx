import type { Metadata } from 'next';

import { OptOutForm } from './OptOutForm';

export const metadata: Metadata = {
  title: 'Unsubscribe from WALT Services Vendor Texts',
  robots: 'noindex',
};

export default function SmsOptOutPage() {
  return (
    <main className="flex min-h-screen items-start justify-center bg-gray-50 px-4 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Unsubscribe from vendor texts</h1>
          <p className="mt-2 text-sm text-gray-600">
            Enter your mobile number below to stop receiving work-related text messages from WALT
            Services.
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <OptOutForm />
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          You can also opt out by replying STOP to any text from WALT Services.{' '}
          <a href="/sms/privacy" className="underline hover:text-gray-600">
            Privacy policy
          </a>
        </p>
      </div>
    </main>
  );
}
