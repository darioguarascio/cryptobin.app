#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';
import { runCreateCommand } from './commands/create.js';
import { loadConfig, resolveBaseUrl, saveConfig } from './config.js';
import { banner, brandGradient, icons } from './ui/theme.js';

function readPackageVersion(): string {
  const dir = dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(readFileSync(join(dir, '..', 'package.json'), 'utf8')) as { version?: string };
  return pkg.version ?? '0.0.0';
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

  program
    .command('create')
    .description('Encrypt a secret locally and upload the ciphertext')
    .argument('[secret]', 'Secret text (omit to prompt or read stdin)')
    .option('-f, --file <path>', 'Read secret from a file')
    .option('--from <name>', 'Optional sender metadata')
    .option('--label <text>', 'Optional label metadata')
    .option('--description <text>', 'Optional description metadata')
    .option('--ttl <hours>', 'Link lifetime: 1, 24, 72, or 168', (value) => Number.parseInt(value, 10))
    .option('-u, --url <base>', 'CryptoBin server base URL')
    .option('--json', 'Print machine-readable JSON')
    .option('-q, --quiet', 'Print only the share URL')
    .option('--no-interactive', 'Skip prompts (requires secret, file, or stdin)')
    .action(async (secret: string | undefined, options) => {
      try {
        await runCreateCommand({
          secret,
          file: options.file,
          from: options.from,
          label: options.label,
          description: options.description,
          ttl: options.ttl,
          url: options.url,
          json: options.json,
          quiet: options.quiet,
          interactive: options.interactive,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Something went wrong.';
        console.error(`${pc.red(icons.warn)} ${message}`);
        process.exitCode = 1;
      }
    });

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
    program.help();
  });

  await program.parseAsync(argv);
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unexpected CLI failure.';
  console.error(`${pc.red(icons.warn)} ${message}`);
  process.exit(1);
});
