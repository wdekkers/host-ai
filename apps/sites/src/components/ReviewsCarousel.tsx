'use client';

import { useEffect, useState } from 'react';
import type { ReviewData } from '@/lib/data';

type ReviewsCarouselProps = {
  reviews: ReviewData[];
};

const REVIEW_DURATION_MS = 15000;

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = temp;
  }
  return copy;
}

export default function ReviewsCarousel({ reviews }: ReviewsCarouselProps): React.ReactNode {
  const [page, setPage] = useState(0);
  const [progress, setProgress] = useState(0);
  const [order, setOrder] = useState(reviews);
  const totalPages = Math.max(1, reviews.length);

  useEffect(() => {
    if (reviews.length === 0) return;
    const shuffled = shuffleArray(reviews);
    setOrder(shuffled);
    setPage(Math.floor(Math.random() * reviews.length));
  }, [reviews]);

  useEffect(() => {
    if (reviews.length <= 1) {
      setProgress(1);
      return undefined;
    }

    let didAdvance = false;
    const startTime = Date.now();
    setProgress(0);

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const p = Math.min(elapsed / REVIEW_DURATION_MS, 1);
      setProgress(p);

      if (elapsed >= REVIEW_DURATION_MS && !didAdvance) {
        didAdvance = true;
        setPage((prev) => {
          const next = (prev + 1) % totalPages;
          if (next === 0 && totalPages > 1) {
            setOrder((current) =>
              current.length > 0 ? shuffleArray(current) : current,
            );
          }
          return next;
        });
      }
    }, 100);

    return () => clearInterval(interval);
  }, [page, totalPages, reviews.length]);

  const currentReview = order[page % order.length];

  if (reviews.length === 0) {
    return (
      <div className="rounded-2xl border border-white/15 bg-white/5 p-4 text-sm text-white/70">
        Reviews are coming soon.
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {currentReview ? (
        <article className="rounded-2xl border border-white/15 bg-white/5 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white">
              {currentReview.name}
            </p>
            {currentReview.location && (
              <p className="text-xs uppercase tracking-[0.2em] text-white/70">
                {currentReview.location}
              </p>
            )}
          </div>
          {currentReview.date && (
            <p className="mt-2 text-xs uppercase tracking-[0.2em] text-white/60">
              {currentReview.date}
            </p>
          )}
          <p className="mt-3 text-sm leading-relaxed text-white/85">
            {currentReview.text}
          </p>
        </article>
      ) : null}
      <div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-[width] duration-100"
          style={{
            width: `${Math.min(progress * 100, 100)}%`,
            backgroundColor: 'var(--color-accent, var(--color-primary))',
          }}
        />
      </div>
    </div>
  );
}
