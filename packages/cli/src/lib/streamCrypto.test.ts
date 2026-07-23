import { describe, expect, it } from 'vitest';
import { encryptStreamFrame, generateStreamKey } from './streamCrypto.js';

describe('streamCrypto (cli)', () => {
  it('encrypts stream frames locally', async () => {
    const { key, algorithm } = await generateStreamKey();
    expect(algorithm).toBe('AES-GCM-256');
    const frame = await encryptStreamFrame(key, 1, 'line\n');
    expect(frame.ciphertext.length).toBeGreaterThan(8);
    expect(frame.iv.length).toBeGreaterThan(8);
  });
});
