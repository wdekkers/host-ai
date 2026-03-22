import { ZodSchema } from "zod";
import { HospitableError, errorCodeFromStatus } from "./error.js";

const BASE_URL = "https://public.api.hospitable.com/v2";

export type HospitableClientConfig = {
  apiKey: string;
  baseUrl?: string;
  onError?: (error: HospitableError) => void;
};

export type RequestOptions = {
  method?: string;
  params?: Record<string, string | string[] | number | undefined>;
  body?: unknown;
  schema?: ZodSchema;
};

export type PaginatedResponse<T> = {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  links: {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
  };
};

export class HttpClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly onError?: (error: HospitableError) => void;

  constructor(config: HospitableClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? BASE_URL;
    this.onError = config.onError;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = "GET", params, body, schema } = options;
    const url = this.buildUrl(path, params);

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      const error = new HospitableError({
        code: "NETWORK",
        status: 0,
        endpoint: `${method} ${path}`,
        message: err instanceof Error ? err.message : "Network error",
      });
      this.onError?.(error);
      throw error;
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      const error = new HospitableError({
        code: errorCodeFromStatus(response.status),
        status: response.status,
        endpoint: `${method} ${path}`,
        message: errorBody || response.statusText,
      });
      this.onError?.(error);
      throw error;
    }

    const json = await response.json();
    if (schema) {
      return schema.parse(json) as T;
    }
    return json as T;
  }

  async requestPaginated<T>(
    path: string,
    options: RequestOptions = {}
  ): Promise<PaginatedResponse<T>> {
    return this.request<PaginatedResponse<T>>(path, options);
  }

  async requestAllPages<T>(
    path: string,
    options: RequestOptions = {}
  ): Promise<T[]> {
    const all: T[] = [];
    let page = 1;
    let lastPage = 1;

    do {
      const params = { ...options.params, page: String(page) };
      const response = await this.requestPaginated<T>(path, {
        ...options,
        params,
      });
      all.push(...response.data);
      lastPage = response.meta.last_page;
      page++;
    } while (page <= lastPage);

    return all;
  }

  private buildUrl(
    path: string,
    params?: Record<string, string | string[] | number | undefined>
  ): string {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined) continue;
        if (Array.isArray(value)) {
          for (const v of value) {
            url.searchParams.append(key, v);
          }
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }
}
