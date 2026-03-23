import type { HttpClient } from "../http.js";
import type { GetUserAndBilling200 } from "../generated/types/index.js";
import { getUserAndBillingQueryResponseSchema } from "../generated/schemas/index.js";

// ---------------------------------------------------------------------------
// UserResource
// ---------------------------------------------------------------------------

export class UserResource {
  constructor(private readonly http: HttpClient) {}

  /** GET /user — get the authenticated user. */
  get() {
    return this.http.request<GetUserAndBilling200>("/user", {
      schema: getUserAndBillingQueryResponseSchema,
    });
  }
}
