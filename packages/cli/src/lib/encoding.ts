export function bytesToBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

export function base64UrlToBytes(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, 'base64url'));
}

export function stringToBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export function bytesToString(value: Uint8Array): string {
  return new TextDecoder().decode(value);
}
