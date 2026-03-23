export type PropertyFactsInput = {
  checkInTime: string | null;
  checkOutTime: string | null;
  timezone: string | null;
  maxGuests: number | null;
  bedrooms: number | null;
  beds: number | null;
  bathrooms: string | null;
  petsAllowed: boolean | null;
  smokingAllowed: boolean | null;
  eventsAllowed: boolean | null;
  amenities: string[] | null;
  propertyType: string | null;
  hasPool: boolean;
  description: string | null;
};

function yn(val: boolean | null): string | null {
  if (val === null) return null;
  return val ? 'Yes' : 'No';
}

export function formatPropertyFacts(input: PropertyFactsInput): string {
  const lines: string[] = [];

  if (input.checkInTime) lines.push(`Check-in: ${input.checkInTime}`);
  if (input.checkOutTime) lines.push(`Check-out: ${input.checkOutTime}`);
  if (input.timezone) lines.push(`Timezone: ${input.timezone}`);
  if (input.maxGuests != null) lines.push(`Max guests: ${input.maxGuests}`);
  if (input.bedrooms != null) lines.push(`Bedrooms: ${input.bedrooms}`);
  if (input.beds != null) lines.push(`Beds: ${input.beds}`);
  if (input.bathrooms != null) lines.push(`Bathrooms: ${input.bathrooms}`);
  if (input.propertyType) lines.push(`Property type: ${input.propertyType}`);

  const petsLine = yn(input.petsAllowed);
  if (petsLine) lines.push(`Pets allowed: ${petsLine}`);
  const smokingLine = yn(input.smokingAllowed);
  if (smokingLine) lines.push(`Smoking allowed: ${smokingLine}`);
  const eventsLine = yn(input.eventsAllowed);
  if (eventsLine) lines.push(`Events allowed: ${eventsLine}`);

  if (input.hasPool) lines.push(`Pool: Yes`);

  if (input.amenities && input.amenities.length > 0) {
    lines.push(`Amenities: ${input.amenities.join(', ')}`);
  }

  if (input.description) lines.push(`Description: ${input.description}`);

  if (lines.length === 0) return '';
  return `Property facts (from listing):\n${lines.map((l) => `- ${l}`).join('\n')}`;
}
