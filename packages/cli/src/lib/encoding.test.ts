import { describe, expect, it } from 'vitest';
import { base64UrlToBytes, bytesToBase64Url, bytesToString, stringToBytes } from './encoding.js';

describe('encoding', () => {
  it('round-trips bytes through base64url', () => {
    const input = new Uint8Array([1, 2, 3, 250, 255]);
    expect(base64UrlToBytes(bytesToBase64Url(input))).toEqual(input);
  });

  it('round-trips utf-8 strings', () => {
    const value = 'hello 🔐';
    expect(bytesToString(stringToBytes(value))).toBe(value);
  });
});
