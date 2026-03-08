import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SMS Messaging Terms — WALT Services',
  robots: 'noindex',
};

export default function SmsTermsPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-2xl font-semibold text-gray-900">SMS Messaging Terms</h1>

        <div className="space-y-6 text-sm text-gray-700">
          <section>
            <h2 className="mb-2 text-base font-semibold text-gray-900">Program description</h2>
            <p>
              WALT Services sends work-related operational text messages to vendors including
              scheduling confirmations, property access information, maintenance coordination, and
              urgent operational notices.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-gray-900">Message frequency</h2>
            <p>Message frequency varies based on operational activity.</p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-gray-900">Costs</h2>
            <p>Message and data rates may apply. Contact your carrier for details.</p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-gray-900">How to opt out</h2>
            <p>
              Reply STOP to any message to unsubscribe. You will receive one final confirmation
              message. You will receive no further messages unless you reply START.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-gray-900">How to get help</h2>
            <p>
              Reply HELP to any message or contact{' '}
              <a href="mailto:support@waltservices.com" className="underline">
                support@waltservices.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-gray-900">Carriers</h2>
            <p>
              Carriers are not liable for delayed or undelivered messages. Supported carriers
              include AT&amp;T, Verizon, T-Mobile, and most US carriers.
            </p>
          </section>
        </div>

        <div className="mt-8 space-y-1 text-xs text-gray-400">
          <p>Last updated: March 2026</p>
          <p>
            <a href="/sms/privacy" className="underline hover:text-gray-600">
              Privacy policy
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
