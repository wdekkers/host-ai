export type DeviceKind = 'doorbell' | 'stickup_cam' | 'chime' | 'other';

export interface RingDevice {
  id: string;
  locationId: string;  // Ring location IDs are numeric strings — do NOT coerce to number
  kind: DeviceKind;
  description: string;
}

export interface RingLocation {
  id: string;
  name: string;
  devices: RingDevice[];
}

type RawDevice = {
  id: string | number;
  location_id: string | number;
  description?: { name?: string } | string;
};

export type RingDevicesResponse = Record<string, RawDevice[]>;

export interface RawLocationEntry {
  location_id: string;
  name: string;
}

const KIND_MAP: Record<string, DeviceKind> = {
  doorbots: 'doorbell',
  authorized_doorbots: 'doorbell',
  stickup_cams: 'stickup_cam',
  chimes: 'chime',
};

function getDescription(raw: RawDevice): string {
  if (typeof raw.description === 'string') return raw.description;
  return raw.description?.name ?? String(raw.id);
}

export function parseRingDevices(response: RingDevicesResponse): RingDevice[] {
  const devices: RingDevice[] = [];
  for (const [key, items] of Object.entries(response)) {
    if (!Array.isArray(items)) continue;
    const kind: DeviceKind = KIND_MAP[key] ?? 'other';
    for (const item of items) {
      devices.push({
        id: String(item.id),
        locationId: String(item.location_id),
        kind,
        description: getDescription(item),
      });
    }
  }
  return devices;
}

export function groupDevicesByLocation(devices: RingDevice[]): Array<Omit<RingLocation, 'name'>> {
  const map = new Map<string, RingDevice[]>();
  for (const device of devices) {
    const existing = map.get(device.locationId) ?? [];
    existing.push(device);
    map.set(device.locationId, existing);
  }
  return Array.from(map.entries()).map(([id, devs]) => ({ id, devices: devs }));
}

export function mergeLocationNames(
  groups: Array<Omit<RingLocation, 'name'>>,
  locationNames: RawLocationEntry[]
): RingLocation[] {
  const nameMap = new Map(locationNames.map(l => [l.location_id, l.name]));
  return groups.map(g => ({
    ...g,
    name: nameMap.get(g.id) ?? g.id,
  }));
}
