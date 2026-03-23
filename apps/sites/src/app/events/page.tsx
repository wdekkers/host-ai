import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Calendar, MapPin } from 'lucide-react';

import { resolveSiteCached } from '@/lib/resolve-site';
import { getEventsData } from '@/lib/data';
import { buildPageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const domain = headersList.get('x-site-domain') ?? '';
  const site = await resolveSiteCached(domain);
  if (!site) return { title: 'Not Found' };

  return buildPageMetadata({
    site,
    title: 'Local Events',
    description: `Upcoming events and things to do near ${site.name}.`,
    path: '/events',
  });
}

export default async function EventsPage(): Promise<React.ReactNode> {
  const headersList = await headers();
  const domain = headersList.get('x-site-domain') ?? '';
  const site = await resolveSiteCached(domain);
  if (!site) return null;

  const events = await getEventsData(site.organizationId);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-28">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gray-500">
          Events
        </p>
        <h1
          className="mt-3 text-4xl font-semibold text-gray-900 sm:text-5xl"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Local events and things to do
        </h1>
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-gray-500">
          No upcoming events at the moment. Check back soon.
        </p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event, index) => (
            <article
              key={`${event.title}-${index}`}
              className="rounded-2xl border border-gray-200 bg-white/90 p-5 shadow-sm"
            >
              <h2 className="text-lg font-semibold text-gray-900">
                {event.title}
              </h2>
              {event.date && (
                <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                  <Calendar className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {new Date(event.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              )}
              {event.location && (
                <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  <span>{event.location}</span>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
