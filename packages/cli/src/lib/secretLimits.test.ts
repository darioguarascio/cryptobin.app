import { describe, expect, it } from 'vitest';
import { assertSecretWithinLimit, MAX_SECRET_BYTES, secretByteLength } from './secretLimits.js';

describe('secretLimits', () => {
  it('counts UTF-8 bytes', () => {
    expect(secretByteLength('a')).toBe(1);
    expect(secretByteLength('€')).toBe(3);
  });

  it('allows payloads up to 4 MiB', () => {
    const secret = 'x'.repeat(MAX_SECRET_BYTES);
    expect(() => assertSecretWithinLimit(secret)).not.toThrow();
  });

  it('rejects payloads over 4 MiB', () => {
    const secret = 'x'.repeat(MAX_SECRET_BYTES + 1);
    expect(() => assertSecretWithinLimit(secret)).toThrow(/4 MiB/);
  });
});
