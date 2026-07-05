import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadConfig, resolveBaseUrl, resolveConfiguredBaseUrl, saveConfig } from './config.js';

let tempDir = '';
let configPath = '';

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = '';
    configPath = '';
  }
  vi.unstubAllEnvs();
});

describe('config', () => {
  it('prefers explicit URLs', () => {
    expect(resolveBaseUrl('https://dev.example/')).toBe('https://dev.example');
  });

  it('falls back to CRYPTOBIN_URL and default', () => {
    vi.stubEnv('CRYPTOBIN_URL', 'https://env.example/');
    expect(resolveBaseUrl()).toBe('https://env.example');
    delete process.env.CRYPTOBIN_URL;
    expect(resolveBaseUrl()).toBe('https://cryptobin.app');
  });

  it('returns an empty config for missing files', async () => {
    await expect(loadConfig('/tmp/cryptobin-cli-missing-config.json')).resolves.toEqual({});
  });

  it('loads and saves config files', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cryptobin-cli-'));
    configPath = join(tempDir, 'config.json');

    await saveConfig({ url: 'https://saved.example' }, configPath);
    await expect(loadConfig(configPath)).resolves.toEqual({ url: 'https://saved.example' });
    await expect(readFile(configPath, 'utf8')).resolves.toContain('saved.example');
  });

  it('reads configured base URLs', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cryptobin-cli-'));
    configPath = join(tempDir, 'config.json');
    await saveConfig({ url: 'https://saved.example' }, configPath);

    await expect(resolveConfiguredBaseUrl(undefined, configPath)).resolves.toBe('https://saved.example');
    await expect(resolveConfiguredBaseUrl('https://override.example', configPath)).resolves.toBe(
      'https://override.example',
    );
  });
});
