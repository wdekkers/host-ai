import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { resolveSiteCached } from '@/lib/resolve-site';
import { getBlogPosts } from '@/lib/data';
import { buildPageMetadata } from '@/lib/seo';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const headersList = await headers();
  const domain = headersList.get('x-site-domain') ?? '';
  const site = await resolveSiteCached(domain);
  if (!site) return { title: 'Not Found' };

  const posts = await getBlogPosts(site.organizationId);
  const post = posts.find((p) => p.slug === slug);
  if (!post) return { title: 'Not Found' };

  return buildPageMetadata({
    site,
    title: post.title,
    description: post.excerpt ?? `Read ${post.title} on ${site.name}.`,
    path: `/blog/${slug}`,
  });
}

export default async function BlogPostPage({ params }: PageProps): Promise<React.ReactNode> {
  const { slug } = await params;
  const headersList = await headers();
  const domain = headersList.get('x-site-domain') ?? '';
  const site = await resolveSiteCached(domain);
  if (!site) return null;

  const posts = await getBlogPosts(site.organizationId);
  const post = posts.find((p) => p.slug === slug);
  if (!post) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 pb-20 pt-28">
      <Link
        href="/blog"
        className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 transition hover:text-gray-900"
      >
        Back to blog
      </Link>
      <h1
        className="mt-6 text-4xl font-semibold text-gray-900 sm:text-5xl"
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        {post.title}
      </h1>
      {post.publishedAt && (
        <p className="mt-3 text-sm text-gray-400">
          {new Date(post.publishedAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      )}
      <div className="mt-8 space-y-4 text-base leading-relaxed text-gray-600">
        {post.excerpt && <p>{post.excerpt}</p>}
        <p className="text-sm text-gray-400 italic">
          Full content is being generated. Check back soon.
        </p>
      </div>
    </main>
  );
}
