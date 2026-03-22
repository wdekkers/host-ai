import type { HttpClient } from "../http.js";
import type {
  AllTransactions200,
  RetrieveATransaction200,
} from "../generated/types/index.js";
import {
  allTransactions200Schema,
  retrieveATransactionQueryResponseSchema,
} from "../generated/schemas/index.js";

// ---------------------------------------------------------------------------
// Param types
// ---------------------------------------------------------------------------

export type ListTransactionsParams = {
  page?: number;
  per_page?: number;
  /** Comma-separated values for related resources to include. */
  include?: string;
};

export type GetTransactionParams = {
  /** Comma-separated values for related resources to include. */
  include?: string;
};

// ---------------------------------------------------------------------------
// TransactionsResource
// ---------------------------------------------------------------------------

export class TransactionsResource {
  constructor(private readonly http: HttpClient) {}

  /** GET /transactions — paginated list of transactions. */
  list(params?: ListTransactionsParams) {
    return this.http.requestPaginated<NonNullable<AllTransactions200["data"]>[number]>(
      "/transactions",
      {
        params: params as Record<string, string | number | undefined>,
        schema: allTransactions200Schema,
      }
    );
  }

  /** GET /transactions/{id} — single transaction by ID. */
  get(id: string, params?: GetTransactionParams) {
    return this.http.request<RetrieveATransaction200>(`/transactions/${id}`, {
      params: params as Record<string, string | number | undefined>,
      schema: retrieveATransactionQueryResponseSchema,
    });
  }
}
