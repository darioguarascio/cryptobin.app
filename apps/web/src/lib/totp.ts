import { generateSecret, generateURI, verify } from 'otplib';

export function createTotpSecret(): string {
  return generateSecret();
}

export function buildTotpUri(secret: string, handle: string, issuer = 'CryptoBin'): string {
  return generateURI({
    issuer,
    label: handle,
    secret,
  });
}

export async function verifyTotpCode(secret: string, code: string): Promise<boolean> {
  try {
    const result = await verify({ secret, token: normalizeTotpCode(code) });
    return result.valid;
  } catch {
    return false;
  }
}

export function normalizeTotpCode(code: string): string {
  return code.replace(/\s+/g, '');
}
