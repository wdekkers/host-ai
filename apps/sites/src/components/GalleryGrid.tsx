'use client';

import { useEffect, useMemo, useState } from 'react';
import type { GalleryImage } from '@/lib/data';

type GalleryGridProps = {
  items: GalleryImage[];
  categories: string[];
};

export default function GalleryGrid({ items, categories }: GalleryGridProps): React.ReactNode {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activeItem = activeIndex === null ? null : items[activeIndex];

  const indexById = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((item, index) => map.set(String(item.id), index));
    return map;
  }, [items]);

  useEffect(() => {
    if (activeIndex === null) return;
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setActiveIndex(null);
      }
      if (event.key === 'ArrowRight') {
        setActiveIndex((prev) =>
          prev === null ? prev : (prev + 1) % items.length,
        );
      }
      if (event.key === 'ArrowLeft') {
        setActiveIndex((prev) =>
          prev === null ? prev : (prev - 1 + items.length) % items.length,
        );
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activeIndex, items.length]);

  return (
    <>
      {categories.map((category) => (
        <section key={category} className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2
              className="text-2xl font-semibold text-gray-900"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              {category}
            </h2>
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-400">
              {items.filter((item) => item.category === category).length}{' '}
              photos
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {items
              .filter((item) => item.category === category)
              .map((image) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() =>
                    setActiveIndex(indexById.get(String(image.id)) ?? 0)
                  }
                  className="group overflow-hidden rounded-2xl border border-gray-200 bg-white/90 text-left shadow-sm"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.src}
                    alt={image.alt}
                    loading="lazy"
                    className="h-56 w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  <p className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                    {image.alt}
                  </p>
                </button>
              ))}
          </div>
        </section>
      ))}

      {activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-8">
          <button
            type="button"
            aria-label="Close gallery"
            onClick={() => setActiveIndex(null)}
            className="absolute right-6 top-6 rounded-full border border-white/40 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white"
          >
            Close
          </button>
          <button
            type="button"
            aria-label="Previous image"
            onClick={() =>
              setActiveIndex((prev) =>
                prev === null
                  ? prev
                  : (prev - 1 + items.length) % items.length,
              )
            }
            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full border border-white/40 bg-white/10 px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white"
          >
            Prev
          </button>
          <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-white/20 bg-black/60 shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeItem.src}
              alt={activeItem.alt}
              className="max-h-[70vh] w-full object-contain"
            />
            <div className="flex items-center justify-between gap-4 px-6 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
              <span>{activeItem.alt}</span>
              <span>
                {(activeIndex ?? 0) + 1} / {items.length}
              </span>
            </div>
          </div>
          <button
            type="button"
            aria-label="Next image"
            onClick={() =>
              setActiveIndex((prev) =>
                prev === null ? prev : (prev + 1) % items.length,
              )
            }
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-white/40 bg-white/10 px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white"
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}
