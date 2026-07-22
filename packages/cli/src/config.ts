import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export const DEFAULT_BASE_URL = 'https://cryptobin.app'; // override via CRYPTOBIN_URL or ~/.config/cryptobin/config.json
export const CONFIG_PATH = join(homedir(), '.config', 'cryptobin', 'config.json');

export interface CliConfig {
  url?: string;
}

export function resolveBaseUrl(explicit?: string): string {
  return (explicit ?? process.env.CRYPTOBIN_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '');
}

export async function loadConfig(configPath = CONFIG_PATH): Promise<CliConfig> {
  try {
    const raw = await readFile(configPath, 'utf8');
    return JSON.parse(raw) as CliConfig;
  } catch {
    return {};
  }
}

export async function saveConfig(config: CliConfig, configPath = CONFIG_PATH): Promise<void> {
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

export async function resolveConfiguredBaseUrl(
  explicit?: string,
  configPath = CONFIG_PATH,
): Promise<string> {
  if (explicit) return resolveBaseUrl(explicit);
  if (process.env.CRYPTOBIN_URL) return resolveBaseUrl();

  const config = await loadConfig(configPath);
  return resolveBaseUrl(config.url);
}
