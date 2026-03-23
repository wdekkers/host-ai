import type { HttpClient } from "../http.js";
import type {
  PropertyFull,
  GetProperty200,
  GetPropertyImages200,
  GetPropertyCalendar200,
  SearchProperties200,
  CreateQuote200,
  CreatePropertiesTags202,
  CreatePropertyIcalImport202,
  UpdatePropertyIcalImport202,
  UpdatePropertyCalendar202,
  CreateQuoteMutationRequest,
  CreatePropertiesTagsMutationRequest,
  CreatePropertyIcalImportMutationRequest,
  UpdatePropertyIcalImportMutationRequest,
  UpdatePropertyCalendarMutationRequest,
  Review,
} from "../generated/types/index.js";
import {
  getProperties200Schema,
  getPropertyQueryResponseSchema,
  searchProperties200Schema,
  getPropertyImages200Schema,
  getPropertyCalendar200Schema,
  updatePropertyCalendarMutationResponseSchema,
  getPropertyReviews200Schema,
  createQuoteMutationResponseSchema,
  createPropertiesTagsMutationResponseSchema,
  createPropertyIcalImportMutationResponseSchema,
  updatePropertyIcalImportMutationResponseSchema,
} from "../generated/schemas/index.js";

// ---------------------------------------------------------------------------
// Param types
// ---------------------------------------------------------------------------

export type ListPropertiesParams = {
  page?: number;
  per_page?: number;
  include?: string;
};

export type GetPropertyParams = {
  include?: string;
};

export type SearchPropertiesParams = {
  start_date: string;
  end_date: string;
  adults: number;
  children?: number;
  infants?: number;
  pets?: number;
  location?: string;
  include?: string;
  page?: number;
  per_page?: number;
};

export type GetPropertyCalendarParams = {
  start_date?: string;
  end_date?: string;
};

export type GetPropertyReviewsParams = {
  page?: number;
  per_page?: number;
  include?: string;
};

// ---------------------------------------------------------------------------
// PropertiesResource
// ---------------------------------------------------------------------------

export class PropertiesResource {
  constructor(private readonly http: HttpClient) {}

  /** GET /properties — paginated list of properties. */
  list(params?: ListPropertiesParams) {
    return this.http.requestPaginated<PropertyFull>("/properties", {
      params: params as Record<string, string | number | undefined>,
      schema: getProperties200Schema,
    });
  }

  /** GET /properties — auto-paginate through all pages. */
  listAll(params?: Omit<ListPropertiesParams, "page">) {
    return this.http.requestAllPages<PropertyFull>("/properties", {
      params: params as Record<string, string | number | undefined>,
      schema: getProperties200Schema,
    });
  }

  /** GET /properties/{uuid} — single property by UUID. */
  get(uuid: string, params?: GetPropertyParams) {
    return this.http.request<GetProperty200>(`/properties/${uuid}`, {
      params: params as Record<string, string | number | undefined>,
      schema: getPropertyQueryResponseSchema,
    });
  }

  /** GET /properties/search — search properties. */
  search(params: SearchPropertiesParams) {
    return this.http.request<SearchProperties200>("/properties/search", {
      params: params as Record<string, string | number | undefined>,
      schema: searchProperties200Schema,
    });
  }

  /** GET /properties/{uuid}/images */
  getImages(uuid: string) {
    return this.http.request<GetPropertyImages200>(
      `/properties/${uuid}/images`,
      {
        schema: getPropertyImages200Schema,
      }
    );
  }

  /** GET /properties/{uuid}/calendar */
  getCalendar(uuid: string, params?: GetPropertyCalendarParams) {
    return this.http.request<GetPropertyCalendar200>(
      `/properties/${uuid}/calendar`,
      {
        params: params as Record<string, string | number | undefined>,
        schema: getPropertyCalendar200Schema,
      }
    );
  }

  /** PUT /properties/{uuid}/calendar */
  updateCalendar(
    uuid: string,
    data: UpdatePropertyCalendarMutationRequest
  ) {
    return this.http.request<UpdatePropertyCalendar202>(
      `/properties/${uuid}/calendar`,
      {
        method: "PUT",
        body: data,
        schema: updatePropertyCalendarMutationResponseSchema,
      }
    );
  }

  /** GET /properties/{uuid}/reviews — paginated. */
  getReviews(uuid: string, params?: GetPropertyReviewsParams) {
    return this.http.requestPaginated<Review>(
      `/properties/${uuid}/reviews`,
      {
        params: params as Record<string, string | number | undefined>,
        schema: getPropertyReviews200Schema,
      }
    );
  }

  /** POST /properties/{uuid}/quote */
  createQuote(uuid: string, data: CreateQuoteMutationRequest) {
    return this.http.request<CreateQuote200>(`/properties/${uuid}/quote`, {
      method: "POST",
      body: data,
      schema: createQuoteMutationResponseSchema,
    });
  }

  /** POST /properties/{uuid}/tags */
  createTag(uuid: string, data: CreatePropertiesTagsMutationRequest) {
    return this.http.request<CreatePropertiesTags202>(
      `/properties/${uuid}/tags`,
      {
        method: "POST",
        body: data,
        schema: createPropertiesTagsMutationResponseSchema,
      }
    );
  }

  /** POST /properties/{uuid}/ical-imports */
  createIcalImport(
    uuid: string,
    data: CreatePropertyIcalImportMutationRequest
  ) {
    return this.http.request<CreatePropertyIcalImport202>(
      `/properties/${uuid}/ical-imports`,
      {
        method: "POST",
        body: data,
        schema: createPropertyIcalImportMutationResponseSchema,
      }
    );
  }

  /** PUT /properties/{uuid}/ical-imports/{icalUuid} */
  updateIcalImport(
    uuid: string,
    icalUuid: string,
    data: UpdatePropertyIcalImportMutationRequest
  ) {
    return this.http.request<UpdatePropertyIcalImport202>(
      `/properties/${uuid}/ical-imports/${icalUuid}`,
      {
        method: "PUT",
        body: data,
        schema: updatePropertyIcalImportMutationResponseSchema,
      }
    );
  }
}
