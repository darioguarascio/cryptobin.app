import pc from 'picocolors';

export function writeVerbose(enabled: boolean | undefined, message: string): void {
  if (!enabled) {
    return;
  }
  console.error(`${pc.dim('→')} ${message}`);
}

export function formatByteCount(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MiB (${bytes} bytes)`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB (${bytes} bytes)`;
  }
  return `${bytes} bytes`;
}
