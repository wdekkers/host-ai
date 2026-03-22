// Client
export { HospitableClient } from "./client.js";
export type { HospitableClientConfig, PaginatedResponse } from "./http.js";

// Error
export { HospitableError, errorCodeFromStatus } from "./error.js";
export type { HospitableErrorCode } from "./error.js";

// Resources (for advanced usage / type imports)
export { PropertiesResource } from "./resources/properties.js";
export { ReservationsResource } from "./resources/reservations.js";
export { InquiriesResource } from "./resources/inquiries.js";
export { ReviewsResource } from "./resources/reviews.js";
export { TransactionsResource } from "./resources/transactions.js";
export { PayoutsResource } from "./resources/payouts.js";
export { UserResource } from "./resources/user.js";

// Generated types & schemas
export * from "./generated/index.js";
