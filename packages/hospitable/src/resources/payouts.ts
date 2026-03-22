import type { HttpClient } from "../http.js";
import type {
  AllPayouts200,
  RetrieveAPayout200,
} from "../generated/types/index.js";
import {
  allPayouts200Schema,
  retrieveAPayoutQueryResponseSchema,
} from "../generated/schemas/index.js";

// ---------------------------------------------------------------------------
// Param types
// ---------------------------------------------------------------------------

export type ListPayoutsParams = {
  page?: number;
  per_page?: number;
  /** Comma-separated values for related resources to include. */
  include?: string;
};

export type GetPayoutParams = {
  /** Comma-separated values for related resources to include. */
  include?: string;
};

// ---------------------------------------------------------------------------
// PayoutsResource
// ---------------------------------------------------------------------------

export class PayoutsResource {
  constructor(private readonly http: HttpClient) {}

  /** GET /payouts — paginated list of payouts. */
  list(params?: ListPayoutsParams) {
    return this.http.requestPaginated<NonNullable<AllPayouts200["data"]>[number]>(
      "/payouts",
      {
        params: params as Record<string, string | number | undefined>,
        schema: allPayouts200Schema,
      }
    );
  }

  /** GET /payouts/{id} — single payout by ID. */
  get(id: string, params?: GetPayoutParams) {
    return this.http.request<RetrieveAPayout200>(`/payouts/${id}`, {
      params: params as Record<string, string | number | undefined>,
      schema: retrieveAPayoutQueryResponseSchema,
    });
  }
}
