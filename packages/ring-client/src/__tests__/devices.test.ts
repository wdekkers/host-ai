import { describe, it, expect } from 'vitest';
import { parseRingDevices, groupDevicesByLocation, mergeLocationNames } from '../devices.js';

const mockDevicesResponse = {
  doorbots: [
    { id: '1', location_id: 'loc-a', description: { name: 'Front Door' } },
  ],
  authorized_doorbots: [
    { id: '2', location_id: 'loc-a', description: { name: 'Shared Bell' } },
  ],
  stickup_cams: [
    { id: '3', location_id: 'loc-b', description: { name: 'Backyard' } },
  ],
  chimes: [
    { id: '4', location_id: 'loc-a', description: { name: 'Chime 1' } },
  ],
  other: [
    { id: '5', location_id: 'loc-b', description: { name: 'Intercom' } },
  ],
};

describe('parseRingDevices', () => {
  it('flattens all device keys into RingDevice array', () => {
    const devices = parseRingDevices(mockDevicesResponse);
    expect(devices).toHaveLength(5);
  });

  it('maps doorbots and authorized_doorbots to kind=doorbell', () => {
    const devices = parseRingDevices(mockDevicesResponse);
    const doorbells = devices.filter(d => d.kind === 'doorbell');
    expect(doorbells).toHaveLength(2);
    expect(doorbells.map(d => d.id)).toContain('1');
    expect(doorbells.map(d => d.id)).toContain('2');
  });

  it('maps stickup_cams to kind=stickup_cam', () => {
    expect(parseRingDevices(mockDevicesResponse).find(d => d.id === '3')?.kind).toBe('stickup_cam');
  });

  it('maps chimes to kind=chime', () => {
    expect(parseRingDevices(mockDevicesResponse).find(d => d.id === '4')?.kind).toBe('chime');
  });

  it('maps unknown keys to kind=other', () => {
    expect(parseRingDevices(mockDevicesResponse).find(d => d.id === '5')?.kind).toBe('other');
  });
});

describe('groupDevicesByLocation', () => {
  it('groups devices by locationId', () => {
    const devices = parseRingDevices(mockDevicesResponse);
    const locations = groupDevicesByLocation(devices);
    expect(locations).toHaveLength(2);
    expect(locations.find(l => l.id === 'loc-a')?.devices).toHaveLength(3);
  });
});

describe('mergeLocationNames', () => {
  it('merges location names from Ring locations API response', () => {
    const devices = parseRingDevices(mockDevicesResponse);
    const groups = groupDevicesByLocation(devices);
    const names = [
      { location_id: 'loc-a', name: 'Beach House' },
      { location_id: 'loc-b', name: 'City Flat' },
    ];
    const merged = mergeLocationNames(groups, names);
    expect(merged.find(l => l.id === 'loc-a')?.name).toBe('Beach House');
    expect(merged.find(l => l.id === 'loc-b')?.name).toBe('City Flat');
  });

  it('falls back to location ID as name when no match found', () => {
    const devices = parseRingDevices(mockDevicesResponse);
    const groups = groupDevicesByLocation(devices);
    const merged = mergeLocationNames(groups, []);
    expect(merged.find(l => l.id === 'loc-a')?.name).toBe('loc-a');
  });
});
