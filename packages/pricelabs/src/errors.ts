export type PriceLabsErrorCode =
  | 'auth_rejected'
  | 'not_found'
  | 'rate_limited'
  | 'server_error'
  | 'network_error'
  | 'parse_error';

export class PriceLabsError extends Error {
  constructor(public readonly code: PriceLabsErrorCode, message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'PriceLabsError';
  }
}
