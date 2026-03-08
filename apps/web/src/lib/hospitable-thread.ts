export type HospitableThreadMessage = {
  id: string;
  reservationId: string;
  guestName: string;
  message: string;
  sentAt: string;
};

export function buildHospitableMessagesPath(input: {
  reservationId: string;
  beforeCursor?: string;
  limit?: number;
}): string {
  const params = new URLSearchParams({
    reservationId: input.reservationId,
    limit: String(input.limit ?? 5)
  });
  if (input.beforeCursor) {
    params.set('beforeCursor', input.beforeCursor);
  }
  return `/api/integrations/hospitable/messages?${params.toString()}`;
}

export function mergeOlderMessages(
  current: HospitableThreadMessage[],
  older: HospitableThreadMessage[]
): HospitableThreadMessage[] {
  const ids = new Set<string>();
  const merged: HospitableThreadMessage[] = [];

  for (const item of [...older, ...current]) {
    if (ids.has(item.id)) {
      continue;
    }
    ids.add(item.id);
    merged.push(item);
  }

  return merged;
}
