import { describe, expect, it } from 'vitest';
import { buildCreateOptions } from './secret.js';

describe('buildCreateOptions', () => {
  it('defaults to quiet output for secret command when text is provided', () => {
    expect(
      buildCreateOptions('top-secret', {}, true),
    ).toEqual(
      expect.objectContaining({
        secret: 'top-secret',
        quiet: true,
      }),
    );
  });

  it('does not force quiet for create alias', () => {
    expect(
      buildCreateOptions('top-secret', {}, false),
    ).toEqual(
      expect.objectContaining({
        quiet: false,
      }),
    );
  });

  it('respects explicit --quiet and --json', () => {
    expect(buildCreateOptions('x', { quiet: false }, true).quiet).toBe(false);
    expect(buildCreateOptions('x', { json: true }, true).quiet).toBe(false);
  });
});
