#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';
import { registerSecretCommand } from './commands/secret.js';
import { loadConfig, resolveBaseUrl, saveConfig } from './config.js';
import { banner, brandGradient, icons } from './ui/theme.js';

function readPackageVersion(): string {
  const dir = dirname(fileURLToPath(import.meta.url));
  const candidates = [join(dir, '..', 'package.json'), join(dir, 'package.json')];
  for (const path of candidates) {
    try {
      const pkg = JSON.parse(readFileSync(path, 'utf8')) as { version?: string };
      if (pkg.version) {
        return pkg.version;
      }
    } catch {
      // try next path
    }
  }
  return '0.0.0';
}

async function runConfigSet(url: string): Promise<void> {
  const normalized = resolveBaseUrl(url);
  await saveConfig({ url: normalized });
  console.log(`${pc.green(icons.check)} Default server set to ${pc.cyan(normalized)}`);
}

async function runConfigShow(): Promise<void> {
  const config = await loadConfig();
  const url = resolveBaseUrl(config.url ?? process.env.CRYPTOBIN_URL);
  console.log(`${pc.dim('Server')}  ${pc.cyan(url)}`);
  console.log(`${pc.dim('Env')}     ${process.env.CRYPTOBIN_URL ? pc.cyan(process.env.CRYPTOBIN_URL) : pc.dim('(not set)')}`);
}

export async function run(argv: string[] = process.argv): Promise<void> {
  const program = new Command();

  program
    .name('cryptobin')
    .description(`${brandGradient('CryptoBin')} — create encrypted one-time share links`)
    .version(readPackageVersion(), '-V, --version', 'Show version');

  registerSecretCommand(program, 'secret', 'Encrypt a secret and print a one-time share URL');
  registerSecretCommand(program, 'create', 'Alias for secret', { quietWhenArg: false });

  const config = program.command('config').description('View or update CLI defaults');

  config
    .command('show')
    .description('Show the configured server URL')
    .action(async () => {
      try {
        await runConfigShow();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to read config.';
        console.error(`${pc.red(icons.warn)} ${message}`);
        process.exitCode = 1;
      }
    });

  config
    .command('set')
    .description('Set the default server URL')
    .requiredOption('--url <base>', 'CryptoBin server base URL')
    .action(async (options) => {
      try {
        await runConfigSet(options.url);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to save config.';
        console.error(`${pc.red(icons.warn)} ${message}`);
        process.exitCode = 1;
      }
    });

  program.action(() => {
    console.log(banner());
    console.log('');
    console.log(`${pc.dim('Usage:')}`);
    console.log(`  ${pc.cyan('cryptobin secret')} ${pc.dim('"your secret"')}     ${pc.dim('# prints share URL')}`);
    console.log(`  ${pc.cyan('echo token | cryptobin secret')}     ${pc.dim('# read from stdin')}`);
    console.log(`  ${pc.cyan('cryptobin secret')}                   ${pc.dim('# interactive prompts')}`);
    console.log('');
    program.help();
  });

  await program.parseAsync(argv);
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unexpected CLI failure.';
  console.error(`${pc.red(icons.warn)} ${message}`);
  process.exit(1);
});
