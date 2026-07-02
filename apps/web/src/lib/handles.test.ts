import { describe, expect, it } from 'vitest';
import { handleValidationMessage, isValidHandle, normalizeHandle, RESERVED_HANDLES } from './handles';

describe('handles', () => {
  it('normalizes to lowercase', () => {
    expect(normalizeHandle(' Alice ')).toBe('alice');
  });

  it('accepts valid handles', () => {
    expect(isValidHandle('alice')).toBe(true);
    expect(isValidHandle('dev-team_1')).toBe(true);
  });

  it('rejects reserved handles', () => {
    for (const handle of RESERVED_HANDLES) {
      expect(isValidHandle(handle)).toBe(false);
      if (handle.length >= 3) {
        expect(handleValidationMessage(handle)).toMatch(/reserved/i);
      }
    }
  });

  it('rejects invalid characters', () => {
    expect(handleValidationMessage('a')).toMatch(/at least 3/i);
    expect(handleValidationMessage('bad handle')).toMatch(/lowercase/i);
  });
});
