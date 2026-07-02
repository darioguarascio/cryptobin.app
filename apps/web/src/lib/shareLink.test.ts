import { describe, expect, it } from 'vitest';
import { shareLinkProfileForTtlHours } from './shareLink';

describe('shareLinkProfileForTtlHours', () => {
  it('uses the smallest profile for one-hour links', () => {
    expect(shareLinkProfileForTtlHours(1)).toEqual({
      idBytes: 6,
      keyBits: 128,
      algorithm: 'AES-GCM-128',
    });
  });

  it('scales id size with longer expiry windows', () => {
    const oneHour = shareLinkProfileForTtlHours(1);
    const oneDay = shareLinkProfileForTtlHours(24);
    const threeDays = shareLinkProfileForTtlHours(72);
    const oneWeek = shareLinkProfileForTtlHours(168);

    expect(oneDay.idBytes).toBeGreaterThan(oneHour.idBytes);
    expect(threeDays.idBytes).toBeGreaterThan(oneDay.idBytes);
    expect(oneWeek.idBytes).toBeGreaterThan(threeDays.idBytes);
  });
});
