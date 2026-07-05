import { cancel, confirm, isCancel, note, outro, password, select, spinner, text } from '@clack/prompts';
import pc from 'picocolors';
import {
  createEncryptedShareLink,
  parseTtlHours,
  readSecretBody,
  type CreateSecretInput,
} from '../lib/createSecret.js';
import { banner, formatTtl, icons, successPanel, ttlOptions } from '../ui/theme.js';

export type { CreateSecretInput, CreateSecretResult } from '../lib/createSecret.js';
export { parseTtlHours, readSecretBody } from '../lib/createSecret.js';

export interface CreateOptions extends CreateSecretInput {
  ttl?: number;
  json?: boolean;
  quiet?: boolean;
  interactive?: boolean;
}

async function promptForCreateDetails(options: CreateOptions): Promise<{
  secret: string;
  from?: string;
  label?: string;
  description?: string;
  ttlHours: number;
}> {
  let secret = await readSecretBody(options);

  if (!secret.trim()) {
    const value = await password({
      message: `${icons.lock} Secret to encrypt`,
      validate: (input) => (input.trim() ? undefined : 'Secret cannot be empty'),
    });
    if (isCancel(value)) {
      cancel('Create cancelled.');
      process.exit(0);
    }
    secret = value;
  }

  let from = options.from;
  let label = options.label;
  let description = options.description;
  let ttlHours = parseTtlHours(options.ttl);

  const addMetadata = await confirm({
    message: 'Add sender or label metadata?',
    initialValue: Boolean(from || label || description),
  });
  if (isCancel(addMetadata)) {
    cancel('Create cancelled.');
    process.exit(0);
  }

  if (addMetadata) {
    if (!from) {
      const value = await text({ message: 'From (optional)', placeholder: 'you@company.com' });
      if (isCancel(value)) {
        cancel('Create cancelled.');
        process.exit(0);
      }
      from = value.trim() || undefined;
    }

    if (!label) {
      const value = await text({ message: 'Label (optional)', placeholder: 'API key rotation' });
      if (isCancel(value)) {
        cancel('Create cancelled.');
        process.exit(0);
      }
      label = value.trim() || undefined;
    }

    if (!description) {
      const value = await text({ message: 'Description (optional)', placeholder: 'For the on-call handoff' });
      if (isCancel(value)) {
        cancel('Create cancelled.');
        process.exit(0);
      }
      description = value.trim() || undefined;
    }
  }

  if (options.ttl === undefined) {
    const picked = await select({
      message: `${icons.timer} Link lifetime`,
      options: ttlOptions.map((option) => ({
        value: option.value,
        label: option.label,
        hint: option.hint,
      })),
      initialValue: 24,
    });
    if (isCancel(picked)) {
      cancel('Create cancelled.');
      process.exit(0);
    }
    ttlHours = picked;
  }

  return { secret, from, label, description, ttlHours };
}

export async function createShareLink(
  options: CreateOptions,
  deps: { fetch?: typeof fetch } = {},
) {
  const interactive =
    options.interactive !== false &&
    !options.secret &&
    !options.file &&
    process.stdin.isTTY;

  const details = interactive
    ? await promptForCreateDetails(options)
    : {
        secret: await readSecretBody(options),
        from: options.from,
        label: options.label,
        description: options.description,
        ttlHours: parseTtlHours(options.ttl),
      };

  const showUi = !options.json && !options.quiet && process.stdin.isTTY;
  const spin = showUi ? spinner() : null;

  spin?.start(`${icons.key} Generating encryption key`);
  spin?.message(`${icons.lock} Encrypting locally`);
  spin?.message(`${icons.rocket} Uploading ciphertext`);

  const result = await createEncryptedShareLink(
    {
      secret: details.secret,
      from: details.from,
      label: details.label,
      description: details.description,
      ttlHours: details.ttlHours,
      url: options.url,
    },
    deps,
  );

  spin?.stop(`${pc.green(icons.check)} Encrypted and stored`);

  if (options.json) {
    return result;
  }

  if (options.quiet) {
    console.log(result.url);
    return result;
  }

  if (showUi) {
    note(successPanel(result), `${icons.link} Copy and share`);
    outro(`${pc.dim('Self-destructs after one read · TTL ')}${formatTtl(result.ttlHours)}`);
    return result;
  }

  console.log(result.url);
  return result;
}

export async function runCreateCommand(options: CreateOptions): Promise<void> {
  if (!options.json && !options.quiet && process.stdin.isTTY) {
    console.log(banner());
    console.log('');
  }

  const result = await createShareLink(options);

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  }
}
