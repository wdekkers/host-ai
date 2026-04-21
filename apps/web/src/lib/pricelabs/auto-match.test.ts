import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { autoMatchListings, normalizeName } from './auto-match';

void describe('normalizeName', () => {
  void it('lowercases and strips punctuation', () => {
    assert.equal(normalizeName('Dreamscape Retreat!'), 'dreamscape retreat');
  });

  void it('strips trailing city/state suffix', () => {
    assert.equal(
      normalizeName('Frisco Waves & Fairways – Frisco, CO'),
      'frisco waves fairways',
    );
  });
});

void describe('autoMatchListings', () => {
  const internalProps = [
    { id: 'prop-1', name: 'Dreamscape' },
    { id: 'prop-2', name: 'Frisco Waves & Fairways' },
    { id: 'prop-3', name: 'Palmera Luxury Villa' },
  ];
  const pricelabsListings = [
    { id: 'pl-1', name: 'Dreamscape Retreat' },
    { id: 'pl-2', name: 'Frisco Waves & Fairways – Frisco, CO' },
    { id: 'pl-3', name: 'Nothing Similar' },
  ];

  void it('high-confidence match when names are close', () => {
    const matches = autoMatchListings(pricelabsListings, internalProps);
    const dreamscape = matches.find((m) => m.pricelabsListingId === 'pl-1');
    assert.ok(dreamscape);
    assert.equal(dreamscape.propertyId, 'prop-1');
    assert.equal(dreamscape.confidence, 'auto-high');
  });

  void it('high-confidence match after city/state suffix strip', () => {
    const matches = autoMatchListings(pricelabsListings, internalProps);
    const waves = matches.find((m) => m.pricelabsListingId === 'pl-2');
    assert.ok(waves);
    assert.equal(waves.propertyId, 'prop-2');
    assert.equal(waves.confidence, 'auto-high');
  });

  void it('returns null match when nothing is close', () => {
    const matches = autoMatchListings(pricelabsListings, internalProps);
    const nothing = matches.find((m) => m.pricelabsListingId === 'pl-3');
    assert.ok(nothing);
    assert.equal(nothing.propertyId, null);
    assert.equal(nothing.confidence, null);
  });

  void it('each internal property matched at most once — best wins', () => {
    const props = [{ id: 'prop-1', name: 'Dreamscape' }];
    const listings = [
      { id: 'pl-1', name: 'Dreamscape' },
      { id: 'pl-2', name: 'Dreamscape Cottage' },
    ];
    const matches = autoMatchListings(listings, props);
    const bestMatch = matches.find((m) => m.propertyId === 'prop-1');
    assert.ok(bestMatch);
    assert.equal(bestMatch.pricelabsListingId, 'pl-1');
    const otherMatch = matches.find((m) => m.pricelabsListingId === 'pl-2');
    assert.ok(otherMatch);
    assert.equal(otherMatch.propertyId, null);
  });
});
