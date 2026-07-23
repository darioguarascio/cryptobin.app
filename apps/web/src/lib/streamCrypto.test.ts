import { describe, expect, it } from 'vitest';
import {
  decryptStreamFrame,
  encryptStreamFrame,
  generateStreamKey,
  buildStreamUrl,
} from '@/lib/streamCrypto';

describe('streamCrypto', () => {
  it('round-trips encrypted frames with the stream key', async () => {
    const { key } = await generateStreamKey();
    const frame = await encryptStreamFrame(key, 1, 'hello world\n');
    const plain = await decryptStreamFrame(key, frame);
    expect(plain).toBe('hello world\n');
  });

  it('decrypts frames from the C CLI (AES-GCM interop vector)', async () => {
    const plain = await decryptStreamFrame('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', {
      seq: 1,
      iv: 'OzxrTcmZ4p5vsLXv',
      ciphertext: 'u4pQbVX1b60Df_GiztE5HakoRAZioOjgBgbB-A0',
    });
    expect(plain).toBe('hello stream\n');
  });

  it('builds stream URLs with hash keys', () => {
    expect(buildStreamUrl('https://cryptobin.app', 'abc', 'key123')).toBe(
      'https://cryptobin.app/stream/abc#key123',
    );
  });
});
