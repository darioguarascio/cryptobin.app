import { describe, expect, it } from 'vitest';
import { shareLinkProfileForTtlHours } from './shareLink.js';

describe('shareLinkProfileForTtlHours', () => {
  it('uses the smallest profile for one-hour links', () => {
    expect(shareLinkProfileForTtlHours(1)).toEqual({
      idBytes: 6,
      keyBits: 128,
      algorithm: 'AES-GCM-128',
    });
  });

  it('scales id length with longer TTLs', () => {
    expect(shareLinkProfileForTtlHours(24).idBytes).toBe(10);
    expect(shareLinkProfileForTtlHours(72).idBytes).toBe(12);
    expect(shareLinkProfileForTtlHours(168).idBytes).toBe(16);
  });
});
