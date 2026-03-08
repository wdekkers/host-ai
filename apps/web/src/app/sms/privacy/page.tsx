import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SMS Privacy Policy — WALT Services',
  robots: 'noindex',
};

export default function SmsPrivacyPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-2xl font-semibold text-gray-900">SMS Privacy Policy</h1>

        <div className="space-y-6 text-sm text-gray-700">
          <section>
            <h2 className="mb-2 text-base font-semibold text-gray-900">What we collect</h2>
            <p>
              When you subscribe to WALT Services vendor text messages, we collect your mobile phone
              number, contact name, and optional company name. We record the date and method of your
              consent for compliance purposes.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-gray-900">
              How we use your information
            </h2>
            <p>
              Your phone number is used solely to send work-related operational text messages
              including scheduling updates, property access notifications, maintenance coordination,
              and urgent operational issues. We do not use your number for marketing or promotional
              communications.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-gray-900">Sharing your information</h2>
            <p>
              We do not sell or share your phone number with third parties for marketing purposes.
              We use Twilio to deliver text messages; your number is transmitted to Twilio solely
              for message delivery.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-gray-900">Opting out</h2>
            <p>
              You may opt out at any time by replying STOP to any text message from WALT Services,
              or by visiting{' '}
              <a href="/sms/opt-out" className="underline">
                our opt-out page
              </a>
              . You will receive a confirmation message when your opt-out is processed.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-gray-900">Contact</h2>
            <p>
              For questions about this policy or your data, contact{' '}
              <a href="mailto:support@waltservices.com" className="underline">
                support@waltservices.com
              </a>
              .
            </p>
          </section>
        </div>

        <p className="mt-8 text-xs text-gray-400">Last updated: March 2026</p>
      </div>
    </main>
  );
}
