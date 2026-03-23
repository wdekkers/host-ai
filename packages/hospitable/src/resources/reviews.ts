import type { HttpClient } from "../http.js";
import type {
  PostReviewsUuidRespond200,
  PostReviewsUuidRespondMutationRequest,
} from "../generated/types/index.js";
import { postReviewsUuidRespondMutationResponseSchema } from "../generated/schemas/index.js";

// ---------------------------------------------------------------------------
// ReviewsResource
// ---------------------------------------------------------------------------

export class ReviewsResource {
  constructor(private readonly http: HttpClient) {}

  /** POST /reviews/{uuid}/respond — respond to a review. */
  respond(uuid: string, data: PostReviewsUuidRespondMutationRequest) {
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
