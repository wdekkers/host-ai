import type { HttpClient } from "../http.js";
import type {
  ReservationFull,
  GetReservation200,
  GetReservationMessages200,
  CreateReservation201,
  UpdateReservation200,
  CancelReservation200,
  SendReservationMessage202,
  ListEnrichableShortcodesByReservation200,
  GetEnrichableShortcodeByKey200,
  GetAnEnrichableShortcodeByKeyCopy200,
  CreateReservationMutationRequest,
  UpdateReservationMutationRequest,
  CancelReservationMutationRequest,
  SendReservationMessageMutationRequest,
  GetAnEnrichableShortcodeByKeyCopyMutationRequest,
} from "../generated/types/index.js";
import {
  getReservations200Schema,
  getReservationQueryResponseSchema,
  getReservationMessages200Schema,
  createReservationMutationResponseSchema,
  updateReservationMutationResponseSchema,
  cancelReservationMutationResponseSchema,
  sendReservationMessageMutationResponseSchema,
  listEnrichableShortcodesByReservation200Schema,
  getEnrichableShortcodeByKeyQueryResponseSchema,
  getAnEnrichableShortcodeByKeyCopyMutationResponseSchema,
} from "../generated/schemas/index.js";

// ---------------------------------------------------------------------------
// Param types
// ---------------------------------------------------------------------------

export type ListReservationsParams = {
  /** Array of property UUIDs to query for. */
  properties: string[];
  page?: number;
  per_page?: number;
  /** Find reservations with check-in/check-out dates after this day. */
  start_date?: string;
  /** Find reservations with check-in/check-out dates before this day. */
  end_date?: string;
  /** Comma-separated values, any of: financials,financialsV2,guest,properties,listings */
  include?: string;
  /** Configure whether to use date values to search by 'checkin' or 'checkout'. */
  date_query?: string;
  /** Find reservations with a reservation code that exactly matches the one given. */
  platform_id?: string;
  /** Find reservations where the last message is after the specified datetime. */
  last_message_at?: string;
  /** Filter reservations by status. */
  status?: string[];
};

export type GetReservationParams = {
  /** Comma-separated values, any of: financials,guest,properties,listings */
  include?: string;
};

export type CreateReservationParams = {
  /** Comma-separated values, any of: guest,user,financials,listings,properties,review */
  include?: string;
};

export type UpdateReservationParams = {
  /** Comma-separated values, any of: guest,user,financials,listings,properties,review */
  include?: string;
};

export type CancelReservationParams = {
  /** Comma-separated values, any of: guest,user,financials,listings,properties,review */
  include?: string;
};

// ---------------------------------------------------------------------------
// ReservationsResource
// ---------------------------------------------------------------------------

export class ReservationsResource {
  constructor(private readonly http: HttpClient) {}

  /** GET /reservations — paginated list of reservations. */
  list(params: ListReservationsParams) {
    return this.http.requestPaginated<ReservationFull>("/reservations", {
      params: this.buildListParams(params),
      schema: getReservations200Schema,
    });
  }

  /** GET /reservations — auto-paginate through all pages. */
  listAll(params: Omit<ListReservationsParams, "page">) {
    return this.http.requestAllPages<ReservationFull>("/reservations", {
      params: this.buildListParams(params),
      schema: getReservations200Schema,
    });
  }

  /** GET /reservations/{uuid} — single reservation by UUID. */
  get(uuid: string, params?: GetReservationParams) {
    return this.http.request<GetReservation200>(`/reservations/${uuid}`, {
      params: params as Record<string, string | number | undefined>,
      schema: getReservationQueryResponseSchema,
    });
  }

  /** POST /reservations — create a new reservation. */
  create(
    data: CreateReservationMutationRequest,
    params?: CreateReservationParams
  ) {
    return this.http.request<CreateReservation201>("/reservations", {
      method: "POST",
      body: data,
      params: params as Record<string, string | number | undefined>,
      schema: createReservationMutationResponseSchema,
    });
  }

  /** PUT /reservations/{uuid} — update an existing reservation. */
  update(
    uuid: string,
    data: UpdateReservationMutationRequest,
    params?: UpdateReservationParams
  ) {
    return this.http.request<UpdateReservation200>(
      `/reservations/${uuid}`,
      {
        method: "PUT",
        body: data,
        params: params as Record<string, string | number | undefined>,
        schema: updateReservationMutationResponseSchema,
      }
    );
  }

  /** POST /reservations/{uuid}/cancel — cancel a reservation. */
  cancel(
    uuid: string,
    data?: CancelReservationMutationRequest,
    params?: CancelReservationParams
  ) {
    return this.http.request<CancelReservation200>(
      `/reservations/${uuid}/cancel`,
      {
        method: "POST",
        body: data,
        params: params as Record<string, string | number | undefined>,
        schema: cancelReservationMutationResponseSchema,
      }
    );
  }

  /** GET /reservations/{uuid}/messages — list messages for a reservation. */
  getMessages(uuid: string) {
    return this.http.request<GetReservationMessages200>(
      `/reservations/${uuid}/messages`,
      {
        schema: getReservationMessages200Schema,
      }
    );
  }

  /** POST /reservations/{uuid}/messages — send a message for a reservation. */
  sendMessage(
    uuid: string,
    data: SendReservationMessageMutationRequest
  ) {
    return this.http.request<SendReservationMessage202>(
      `/reservations/${uuid}/messages`,
      {
        method: "POST",
        body: data,
        schema: sendReservationMessageMutationResponseSchema,
      }
    );
  }

  /** GET /reservations/{uuid}/enrichment — list enrichable shortcodes. */
  getEnrichment(uuid: string) {
    return this.http.request<ListEnrichableShortcodesByReservation200>(
      `/reservations/${uuid}/enrichment`,
      {
        schema: listEnrichableShortcodesByReservation200Schema,
      }
    );
  }

  /** GET /reservations/{uuid}/enrichment/{key} — get a single enrichable shortcode. */
  getEnrichmentByKey(uuid: string, key: string) {
    return this.http.request<GetEnrichableShortcodeByKey200>(
      `/reservations/${uuid}/enrichment/${key}`,
      {
        schema: getEnrichableShortcodeByKeyQueryResponseSchema,
      }
    );
  }

  /** PUT /reservations/{uuid}/enrichment/{key} — set a single enrichable shortcode. */
  setEnrichmentByKey(
    uuid: string,
    key: string,
    data: GetAnEnrichableShortcodeByKeyCopyMutationRequest
  ) {
    return this.http.request<GetAnEnrichableShortcodeByKeyCopy200>(
      `/reservations/${uuid}/enrichment/${key}`,
      {
        method: "PUT",
        body: data,
        schema: getAnEnrichableShortcodeByKeyCopyMutationResponseSchema,
      }
    );
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Converts ListReservationsParams into the query-param record expected by
   * HttpClient.  The API requires `properties[]` and `status[]` as array
   * query-parameter keys.
   */
  private buildListParams(
    params: Omit<ListReservationsParams, "page"> & { page?: number }
  ): Record<string, string | string[] | number | undefined> {
    const {
      properties,
      status,
      page,
      per_page,
      start_date,
      end_date,
      include,
      date_query,
      platform_id,
      last_message_at,
    } = params;

    return {
      "properties[]": properties,
      ...(status ? { "status[]": status } : {}),
      page,
      per_page,
      start_date,
      end_date,
      include,
      date_query,
      platform_id,
      last_message_at,
    };
  }
}
