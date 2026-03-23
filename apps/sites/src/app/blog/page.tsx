import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';

import { resolveSiteCached } from '@/lib/resolve-site';
import { getBlogPosts } from '@/lib/data';
import { buildPageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const domain = headersList.get('x-site-domain') ?? '';
  const site = await resolveSiteCached(domain);
  if (!site) return { title: 'Not Found' };

  return buildPageMetadata({
    site,
    title: 'Blog',
    description: `Guides, tips, and local insights from ${site.name}.`,
    path: '/blog',
  });
}

export default async function BlogPage(): Promise<React.ReactNode> {
  const headersList = await headers();
  const domain = headersList.get('x-site-domain') ?? '';
  const site = await resolveSiteCached(domain);
  if (!site) return null;

  const posts = await getBlogPosts(site.organizationId);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-28">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gray-500">
          Blog
        </p>
        <h1
          className="mt-3 text-4xl font-semibold text-gray-900 sm:text-5xl"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Guides and local tips
        </h1>
      </div>

      {posts.length === 0 ? (
        <p className="text-sm text-gray-500">Blog posts are coming soon.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group rounded-2xl border border-gray-200 bg-white/90 p-5 shadow-sm transition hover:shadow-md"
            >
              <h2 className="text-lg font-semibold text-gray-900 group-hover:underline">
                {post.title}
              </h2>
              {post.excerpt && (
                <p className="mt-2 text-sm text-gray-500 line-clamp-3">
                  {post.excerpt}
                </p>
              )}
              {post.publishedAt && (
                <p className="mt-3 text-xs text-gray-400">
                  {new Date(post.publishedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
