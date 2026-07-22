import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatByteCount, writeVerbose } from './verbose.js';

describe('verbose', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes to stderr when enabled', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    writeVerbose(true, 'hello');
    expect(spy).toHaveBeenCalledOnce();
    writeVerbose(false, 'skip');
    expect(spy).toHaveBeenCalledOnce();
  });

  it('formats byte counts', () => {
    expect(formatByteCount(512)).toBe('512 bytes');
    expect(formatByteCount(2048)).toContain('KiB');
    expect(formatByteCount(4 * 1024 * 1024)).toContain('MiB');
  });
});
