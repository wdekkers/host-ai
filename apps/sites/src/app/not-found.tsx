import Link from 'next/link';

export default function NotFound(): React.ReactNode {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-6xl flex-col items-center justify-center gap-6 px-6 py-20 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gray-400">
        404
      </p>
      <h1
        className="text-4xl font-semibold text-gray-900 sm:text-5xl"
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        Page not found
      </h1>
      <p className="max-w-md text-base text-gray-500">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/"
        className="rounded-full px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:-translate-y-0.5"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        Back to home
      </Link>
    </main>
  );
}
