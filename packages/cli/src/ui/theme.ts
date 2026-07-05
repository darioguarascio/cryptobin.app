import gradient from 'gradient-string';
import pc from 'picocolors';

export const icons = {
  lock: '🔐',
  key: '🔑',
  link: '🔗',
  timer: '⏱',
  shield: '🛡',
  spark: '✦',
  check: '✔',
  warn: '⚠',
  rocket: '🚀',
} as const;

export function brandGradient(text: string): string {
  return gradient(['#6366f1', '#8b5cf6', '#d946ef'])(text);
}

export function banner(): string {
  const art = [
    '   ╭──────────────────────────────────────╮',
    '   │  ' + brandGradient('CryptoBin') + ' ' + pc.dim('encrypted links') + '       │',
    '   ╰──────────────────────────────────────╯',
  ].join('\n');

  return `${art}\n${pc.dim('   Browser-grade encryption, terminal speed.')}`;
}

export function successPanel(input: { url: string; expiresAt: string; ttlHours: number }): string {
  const expiry = new Date(input.expiresAt).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  const lines = [
    `${pc.green(icons.check)} ${pc.bold('Share link ready')}`,
    '',
    `${icons.link} ${pc.cyan(input.url)}`,
    '',
    `${icons.timer} ${pc.dim('Expires')}  ${expiry} ${pc.dim(`(${formatTtl(input.ttlHours)})`)}`,
    `${icons.shield} ${pc.dim('Key in URL fragment — previews cannot fetch or decrypt')}`,
    `${pc.dim('Recipient clicks to reveal — safe to paste in Slack, iMessage, etc.')}`,
  ];

  return [
    pc.green('╭' + '─'.repeat(52) + '╮'),
    ...lines.map((line) => pc.green('│') + ' ' + line.padEnd(51) + pc.green('│')),
    pc.green('╰' + '─'.repeat(52) + '╯'),
  ].join('\n');
}

export function formatTtl(hours: number): string {
  if (hours === 1) return '1 hour';
  if (hours === 24) return '24 hours';
  if (hours === 72) return '3 days';
  if (hours === 168) return '7 days';
  return `${hours} hours`;
}

export const ttlOptions = [
  { value: 1, label: '1 hour', hint: 'shortest links' },
  { value: 24, label: '24 hours', hint: 'default' },
  { value: 72, label: '3 days', hint: 'team handoffs' },
  { value: 168, label: '7 days', hint: 'longest TTL' },
] as const;
