import type { Metadata } from 'next';

import { OptInForm } from './OptInForm';

export const metadata: Metadata = {
  title: 'Subscribe to WALT Services Vendor Texts',
  robots: 'noindex',
};

export default function SmsOptInPage() {
  return (
    <main className="flex min-h-screen items-start justify-center bg-gray-50 px-4 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Vendor text message opt-in</h1>
          <p className="mt-2 text-sm text-gray-600">
            Subscribe to receive work-related text messages from WALT Services about scheduling,
            property access, and operational updates.
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <OptInForm />
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Message and data rates may apply. Reply STOP to opt out. Reply HELP for help.{' '}
          <a href="/sms/privacy" className="underline hover:text-gray-600">
            Privacy policy
          </a>{' '}
          ·{' '}
          <a href="/sms/terms" className="underline hover:text-gray-600">
            Terms
          </a>
        </p>
      </div>
    </main>
  );
}
