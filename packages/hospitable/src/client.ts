import { HttpClient } from "./http.js";
import type { HospitableClientConfig } from "./http.js";
import { PropertiesResource } from "./resources/properties.js";
import { ReservationsResource } from "./resources/reservations.js";
import { InquiriesResource } from "./resources/inquiries.js";
import { ReviewsResource } from "./resources/reviews.js";
import { TransactionsResource } from "./resources/transactions.js";
import { PayoutsResource } from "./resources/payouts.js";
import { UserResource } from "./resources/user.js";

export class HospitableClient {
  readonly properties: PropertiesResource;
  readonly reservations: ReservationsResource;
  readonly inquiries: InquiriesResource;
  readonly reviews: ReviewsResource;
  readonly transactions: TransactionsResource;
  readonly payouts: PayoutsResource;
  readonly user: UserResource;

  constructor(config: HospitableClientConfig) {
    const http = new HttpClient(config);
    this.properties = new PropertiesResource(http);
    this.reservations = new ReservationsResource(http);
    this.inquiries = new InquiriesResource(http);
    this.reviews = new ReviewsResource(http);
    this.transactions = new TransactionsResource(http);
    this.payouts = new PayoutsResource(http);
    this.user = new UserResource(http);
  }
}
