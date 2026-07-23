import { createInterface } from 'node:readline';
import type { Command } from 'commander';
import pc from 'picocolors';
import { resolveConfiguredBaseUrl } from '../config.js';
import { parseTtlHours } from '../lib/createSecret.js';
import { createStreamSession, postStreamPayload } from '../lib/streamApi.js';
import { buildStreamUrl, encryptStreamFrame, generateStreamKey } from '../lib/streamCrypto.js';
import { writeVerbose } from '../lib/verbose.js';
import { icons } from '../ui/theme.js';

export interface StreamOptions {
  ttl?: number;
  url?: string;
  label?: string;
  json?: boolean;
  quiet?: boolean;
  verbose?: boolean;
}

const MAX_FRAME_BYTES = 64 * 1024;

function printShareUrl(shareUrl: string, piped: boolean, quiet: boolean): void {
  if (piped) {
    console.error(shareUrl);
    return;
  }
  if (quiet) {
    console.log(shareUrl);
    return;
  }
  console.log(shareUrl);
}

async function readStdinLines(onLine: (line: string) => Promise<void>): Promise<void> {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of rl) {
    await onLine(line);
  }
}

export async function runStreamCommand(options: StreamOptions): Promise<void> {
  const piped = !process.stdin.isTTY;
  const baseUrl = await resolveConfiguredBaseUrl(options.url);
  const ttlHours = parseTtlHours(options.ttl);
  writeVerbose(options.verbose, `Server: ${baseUrl}`);
  writeVerbose(options.verbose, `TTL: ${ttlHours} hour(s)`);

  const { key } = await generateStreamKey();
  const session = await createStreamSession(baseUrl, { ttlHours, label: options.label });
  const shareUrl = buildStreamUrl(baseUrl, session.id, key);

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          id: session.id,
          url: shareUrl,
          expiresAt: session.expiresAt,
          ttlHours,
        },
        null,
        2,
      ),
    );
  } else {
    printShareUrl(shareUrl, piped, Boolean(options.quiet));
    writeVerbose(options.verbose, `Producer token issued · stream id ${session.id}`);
  }

  if (!piped) {
    console.error(`${pc.yellow(icons.warn)} Pipe stdin to stream, e.g. tail -f file | cryptobin stream`);
    return;
  }

  writeVerbose(options.verbose, 'Forwarding stdin via encrypted HTTP frames (tee to stdout)');

  let seq = 0;
  await readStdinLines(async (line) => {
    const payload = `${line}\n`;
    if (Buffer.byteLength(payload, 'utf8') > MAX_FRAME_BYTES) {
      throw new Error(`Stream line exceeds ${MAX_FRAME_BYTES} bytes`);
    }
    process.stdout.write(payload);
    seq += 1;
    const frame = await encryptStreamFrame(key, seq, payload);
    await postStreamPayload(baseUrl, session.id, session.producerToken, {
      type: 'frame',
      ...frame,
    });
  });

  await postStreamPayload(baseUrl, session.id, session.producerToken, { type: 'end' });
}

export function registerStreamCommand(program: Command): Command {
  return program
    .command('stream')
    .description('Stream stdin to an encrypted live web URL (tee to stdout when piped)')
    .option('--ttl <hours>', 'Stream lifetime: 1, 24, 72, or 168', (value) => Number.parseInt(value, 10))
    .option('--label <text>', 'Optional label for the stream session')
    .option('-u, --url <base>', 'CryptoBin server base URL')
    .option('--json', 'Print machine-readable JSON (includes share URL)')
    .option('-q, --quiet', 'When piped, print only the share URL on stderr')
    .option('-v, --verbose', 'Print progress to stderr')
    .action(async (opts: StreamOptions) => {
      try {
        const globalVerbose = program.opts<{ verbose?: boolean }>().verbose;
        await runStreamCommand({ ...opts, verbose: Boolean(opts.verbose || globalVerbose) });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Something went wrong.';
        console.error(`${pc.red(icons.warn)} ${message}`);
        process.exitCode = 1;
      }
    });
}
