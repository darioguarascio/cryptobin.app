import { describe, expect, it } from 'vitest';
import {
  assertSecretWithinLimit,
  MAX_CIPHERTEXT_B64_LENGTH,
  MAX_SECRET_BYTES,
  secretByteLength,
} from './secretLimits';

describe('secretLimits', () => {
  it('counts UTF-8 bytes', () => {
    expect(secretByteLength('a')).toBe(1);
  });

  it('rejects secrets over 4 MiB', () => {
    expect(() => assertSecretWithinLimit('x'.repeat(MAX_SECRET_BYTES + 1))).toThrow(/4 MiB/);
  });

  it('allows ciphertext bound to cover max plaintext', () => {
    expect(MAX_CIPHERTEXT_B64_LENGTH).toBeGreaterThan((MAX_SECRET_BYTES * 4) / 3);
  });
});
