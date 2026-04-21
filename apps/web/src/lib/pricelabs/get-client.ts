import { createPriceLabsClient, type PriceLabsClient } from '@walt/pricelabs';

export function getPriceLabsClient(): PriceLabsClient | null {
  const apiKey = process.env.PRICELABS_API_KEY?.trim();
  if (!apiKey) return null;
  return createPriceLabsClient({ apiKey });
}
