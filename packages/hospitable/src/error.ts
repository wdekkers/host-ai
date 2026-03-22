export type HospitableErrorCode =
  | "AUTH"
  | "NOT_FOUND"
  | "RATE_LIMIT"
  | "VALIDATION"
  | "SERVER"
  | "NETWORK";

export class HospitableError extends Error {
  readonly code: HospitableErrorCode;
  readonly status: number;
  readonly endpoint: string;

  constructor(params: {
    code: HospitableErrorCode;
    status: number;
    endpoint: string;
    message: string;
  }) {
    super(params.message);
    this.name = "HospitableError";
    this.code = params.code;
    this.status = params.status;
    this.endpoint = params.endpoint;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      status: this.status,
      endpoint: this.endpoint,
      message: this.message,
    };
  }
}

export function errorCodeFromStatus(status: number): HospitableErrorCode {
  if (status === 401 || status === 403) return "AUTH";
  if (status === 404) return "NOT_FOUND";
  if (status === 429) return "RATE_LIMIT";
  if (status >= 400 && status < 500) return "VALIDATION";
  if (status >= 500) return "SERVER";
  return "SERVER";
}
