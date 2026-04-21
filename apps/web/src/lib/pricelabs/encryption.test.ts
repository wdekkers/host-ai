import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { encryptApiKey, decryptApiKey, keyFingerprint } from './encryption';

void describe('PriceLabs encryption', () => {
  before(() => {
    process.env.PRICELABS_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
  });

  void it('round-trips plaintext', () => {
    const plaintext = 'pl-live-key-abcdef1234567890';
    const encrypted = encryptApiKey(plaintext);
    const decrypted = decryptApiKey(encrypted);
    assert.equal(decrypted, plaintext);
  });

  void it('produces different ciphertexts for same plaintext (fresh IV)', () => {
    const plaintext = 'same-key';
    assert.notEqual(encryptApiKey(plaintext), encryptApiKey(plaintext));
  });

  void it('fingerprint returns last 4 chars', () => {
    assert.equal(keyFingerprint('abcdefghij'), 'ghij');
    assert.equal(keyFingerprint('xyz'), 'xyz');
  });

  void it('decrypt rejects tampered ciphertext', () => {
    const enc = encryptApiKey('hello');
    const tampered = enc.slice(0, -2) + 'zz';
    assert.throws(() => decryptApiKey(tampered));
  });

  void it('throws if PRICELABS_ENCRYPTION_KEY missing', () => {
    const saved = process.env.PRICELABS_ENCRYPTION_KEY;
    delete process.env.PRICELABS_ENCRYPTION_KEY;
    assert.throws(() => encryptApiKey('x'), /PRICELABS_ENCRYPTION_KEY/);
    process.env.PRICELABS_ENCRYPTION_KEY = saved;
  });

  void it('throws if decoded key is not 32 bytes', () => {
    const saved = process.env.PRICELABS_ENCRYPTION_KEY;
    // 16-byte key (too short)
    process.env.PRICELABS_ENCRYPTION_KEY = Buffer.alloc(16).toString('base64');
    assert.throws(() => encryptApiKey('x'), /32 bytes/);
    process.env.PRICELABS_ENCRYPTION_KEY = saved;
  });
});
