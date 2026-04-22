import type { HttpClient } from "../http.js";
import type {
  PostReviewsUuidRespond200,
  PostReviewsUuidRespondMutationRequest,
} from "../generated/types/index.js";
import {
  postReviewsUuidRespondMutationResponseSchema,
  getPropertyReviews200Schema,
} from "../generated/schemas/index.js";
import type { z } from "zod";

export type ListReviewsQuery = {
  page?: number;
  per_page?: number;
  include?: string;
};

export type ListReviewsResponse = z.infer<typeof getPropertyReviews200Schema>;

// ---------------------------------------------------------------------------
// ReviewsResource
// ---------------------------------------------------------------------------

export class ReviewsResource {
  constructor(private readonly http: HttpClient) {}

  /** GET /properties/{uuid}/reviews — list reviews for a property. */
  list(
    propertyUuid: string,
    query: ListReviewsQuery = {}
  ): Promise<ListReviewsResponse> {
    const params = new URLSearchParams();
    if (query.page !== undefined) params.set("page", String(query.page));
    if (query.per_page !== undefined)
      params.set("per_page", String(query.per_page));
    if (query.include) params.set("include", query.include);
    const qs = params.toString();
    const path = `/properties/${propertyUuid}/reviews${qs ? `?${qs}` : ""}`;
    return this.http.request<ListReviewsResponse>(path, {
      method: "GET",
      schema: getPropertyReviews200Schema,
    });
  }

  /** POST /reviews/{uuid}/respond — respond to a review. */
  respond(
    uuid: string,
    data: PostReviewsUuidRespondMutationRequest
  ): Promise<PostReviewsUuidRespond200> {
    return this.http.request<PostReviewsUuidRespond200>(
      `/reviews/${uuid}/respond`,
      {
        method: "POST",
        body: data,
        schema: postReviewsUuidRespondMutationResponseSchema,
      }
    );
  }
}
