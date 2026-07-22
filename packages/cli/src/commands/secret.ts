import type { Command } from 'commander';
import pc from 'picocolors';
import { runCreateCommand, type CreateOptions } from './create.js';
import { icons } from '../ui/theme.js';

export interface SecretCommandOptions {
  file?: string;
  from?: string;
  label?: string;
  description?: string;
  ttl?: number;
  url?: string;
  json?: boolean;
  quiet?: boolean;
  verbose?: boolean;
  interactive?: boolean;
}

export function buildCreateOptions(
  secret: string | undefined,
  opts: SecretCommandOptions,
  quietWhenArg: boolean,
): CreateOptions {
  return {
    secret,
    file: opts.file,
    from: opts.from,
    label: opts.label,
    description: opts.description,
    ttl: opts.ttl,
    url: opts.url,
    json: opts.json,
    quiet: opts.quiet ?? (quietWhenArg && Boolean(secret) && !opts.json && !opts.verbose),
    verbose: opts.verbose,
    interactive: opts.interactive,
  };
}

export function registerSecretCommand(
  program: Command,
  name: string,
  description: string,
  options?: { quietWhenArg?: boolean },
): Command {
  const quietWhenArg = options?.quietWhenArg ?? name === 'secret';

  return program
    .command(name)
    .description(description)
    .argument('[secret]', 'Secret text (omit to prompt or read stdin)')
    .option('-f, --file <path>', 'Read secret from a file')
    .option('--from <name>', 'Optional sender metadata')
    .option('--label <text>', 'Optional label metadata')
    .option('--description <text>', 'Optional description metadata')
    .option('--ttl <hours>', 'Link lifetime: 1, 24, 72, or 168', (value) => Number.parseInt(value, 10))
    .option('-u, --url <base>', 'CryptoBin server base URL')
    .option('--json', 'Print machine-readable JSON')
    .option('-q, --quiet', 'Print only the share URL')
    .option('-v, --verbose', 'Print progress and upload details to stderr')
    .option('--no-interactive', 'Skip prompts (requires secret, file, or stdin)')
    .action(async (secret: string | undefined, opts: SecretCommandOptions) => {
      try {
        const globalVerbose = program.opts<{ verbose?: boolean }>().verbose;
        const verbose = Boolean(opts.verbose || globalVerbose);
        await runCreateCommand({
          ...buildCreateOptions(secret, { ...opts, verbose }, quietWhenArg),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Something went wrong.';
        console.error(`${pc.red(icons.warn)} ${message}`);
        process.exitCode = 1;
      }
    });
}
