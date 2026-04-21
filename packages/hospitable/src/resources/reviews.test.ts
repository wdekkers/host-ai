import { describe, it, expect, vi } from 'vitest';
import { ReviewsResource } from './reviews.js';

describe('ReviewsResource.list', () => {
  it('calls GET /properties/{uuid}/reviews with query params', async () => {
    const request = vi.fn().mockResolvedValue({ data: [], meta: { current_page: 1 } });
    const http = { request } as unknown as ConstructorParameters<typeof ReviewsResource>[0];
    const resource = new ReviewsResource(http);

    await resource.list('prop-uuid-1', { page: 1, per_page: 50 });

    expect(request).toHaveBeenCalledWith(
      '/properties/prop-uuid-1/reviews?page=1&per_page=50',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});
