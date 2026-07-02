import { describe, expect, it } from 'vitest';
import { resolveTheme } from './theme';

describe('resolveTheme', () => {
  it('uses stored preference when valid', () => {
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('falls back to dark when nothing is stored', () => {
    expect(resolveTheme(null)).toBe('dark');
    expect(resolveTheme('invalid')).toBe('dark');
  });
});
