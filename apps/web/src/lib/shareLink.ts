export type ShareCipherAlgorithm = 'AES-GCM-128' | 'AES-GCM-256';

export interface ShareLinkProfile {
  idBytes: number;
  keyBits: 128 | 256;
  algorithm: ShareCipherAlgorithm;
}

export function shareLinkProfileForTtlHours(ttlHours: number): ShareLinkProfile {
  if (ttlHours <= 1) {
    return { idBytes: 6, keyBits: 128, algorithm: 'AES-GCM-128' };
  }

  if (ttlHours <= 24) {
    return { idBytes: 10, keyBits: 256, algorithm: 'AES-GCM-256' };
  }

  if (ttlHours <= 72) {
    return { idBytes: 12, keyBits: 256, algorithm: 'AES-GCM-256' };
  }

  return { idBytes: 16, keyBits: 256, algorithm: 'AES-GCM-256' };
}
