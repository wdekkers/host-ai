import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "../db.js";
import { inventoryHolds } from "@walt/db";

export type CreateHoldParams = {
  siteId: string;
  propertyId: string;
  checkIn: Date;
  checkOut: Date;
  paymentIntentId?: string;
  holdDurationMinutes: number;
};

export type Hold = {
  id: string;
  siteId: string;
  propertyId: string;
  checkIn: Date;
  checkOut: Date;
  paymentIntentId: string | null;
  expiresAt: Date;
  released: boolean;
};

export async function createInventoryHold(params: CreateHoldParams): Promise<Hold> {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + params.holdDurationMinutes);

  const [hold] = await db
    .insert(inventoryHolds)
    .values({
      siteId: params.siteId,
      propertyId: params.propertyId,
      checkIn: params.checkIn,
      checkOut: params.checkOut,
      paymentIntentId: params.paymentIntentId,
      expiresAt,
    })
    .returning();

  return hold as Hold;
}

export async function releaseInventoryHold(holdId: string): Promise<void> {
  await db
    .update(inventoryHolds)
    .set({ released: true })
    .where(eq(inventoryHolds.id, holdId));
}

export async function releaseHoldByPaymentIntent(paymentIntentId: string): Promise<void> {
  await db
    .update(inventoryHolds)
    .set({ released: true })
    .where(eq(inventoryHolds.paymentIntentId, paymentIntentId));
}

export async function hasConflictingHold(
  siteId: string,
  propertyId: string,
  checkIn: Date,
  checkOut: Date
): Promise<boolean> {
  const now = new Date();

  // Find active (not released, not expired) holds that overlap with the requested dates
  const conflicting = await db
    .select({ id: inventoryHolds.id })
    .from(inventoryHolds)
    .where(
      and(
        eq(inventoryHolds.siteId, siteId),
        eq(inventoryHolds.propertyId, propertyId),
        eq(inventoryHolds.released, false),
        gt(inventoryHolds.expiresAt, now),
        // Date ranges overlap if: start1 < end2 AND start2 < end1
        lt(inventoryHolds.checkIn, checkOut),
        gt(inventoryHolds.checkOut, checkIn)
      )
    )
    .limit(1);

  return conflicting.length > 0;
}

export async function pruneExpiredHolds(): Promise<number> {
  const now = new Date();

  const result = await db
    .delete(inventoryHolds)
    .where(
      and(
        lt(inventoryHolds.expiresAt, now),
        eq(inventoryHolds.released, false)
      )
    )
    .returning({ id: inventoryHolds.id });

  return result.length;
}
