import type { HttpClient } from "../http.js";
import type {
  Inquiry,
  GetInquiry200,
  SendInquiryMessage202,
  SendInquiryMessageMutationRequest,
} from "../generated/types/index.js";
import {
  getInquiries200Schema,
  getInquiryQueryResponseSchema,
  sendInquiryMessageMutationResponseSchema,
} from "../generated/schemas/index.js";

// ---------------------------------------------------------------------------
// Param types
// ---------------------------------------------------------------------------

export type ListInquiriesParams = {
  /** Array of property UUIDs to query for. */
  properties: string[];
  page?: number;
  per_page?: number;
  /** Comma-separated values for related resources to include. */
  include?: string;
  /** Find inquiries where the last message is after the specified datetime. */
  last_message_at?: string;
};

export type GetInquiryParams = {
  /** Comma-separated values for related resources to include. */
  include?: string;
};

// ---------------------------------------------------------------------------
// InquiriesResource
// ---------------------------------------------------------------------------

export class InquiriesResource {
  constructor(private readonly http: HttpClient) {}

  /** GET /inquiries — paginated list of inquiries. */
  list(params: ListInquiriesParams) {
    const { properties, ...rest } = params;
    return this.http.requestPaginated<Inquiry>("/inquiries", {
      params: {
        ...rest,
        "properties[]": properties,
      } as Record<string, string | string[] | number | undefined>,
      schema: getInquiries200Schema,
    });
  }

  /** GET /inquiries/{uuid} — single inquiry by UUID. */
  get(uuid: string, params?: GetInquiryParams) {
    return this.http.request<GetInquiry200>(`/inquiries/${uuid}`, {
      params: params as Record<string, string | number | undefined>,
      schema: getInquiryQueryResponseSchema,
    });
  }

  /** POST /inquiries/{uuid}/messages — send a message for an inquiry. */
  sendMessage(uuid: string, data: SendInquiryMessageMutationRequest) {
    return this.http.request<SendInquiryMessage202>(
      `/inquiries/${uuid}/messages`,
      {
        method: "POST",
        body: data,
        schema: sendInquiryMessageMutationResponseSchema,
      }
    );
  }
}
