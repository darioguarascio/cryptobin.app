export function normalizeSiteUrl(raw: string | undefined): string {
  const trimmed = raw?.trim();
  if (!trimmed) return '';
  return trimmed.replace(/\/$/, '');
}

/** Prefer SITE_URL; local dev fallback only when unset. */
export function resolveSiteUrl(env: NodeJS.ProcessEnv = process.env): string {
  const configured = normalizeSiteUrl(env.SITE_URL);
  if (configured) return configured;
  if (env.NODE_ENV === 'production') return '';
  return 'http://localhost:4321';
}

export interface RybbitConfig {
  scriptSrc: string;
  siteId: string;
}

/** Rybbit analytics — omitted from HTML unless both RYBBIT_HOST and RYBBIT_SITE_ID are set. */
export function resolveRybbitConfig(env: NodeJS.ProcessEnv = process.env): RybbitConfig | null {
  const host = env.RYBBIT_HOST?.trim().replace(/\/$/, '');
  const siteId = env.RYBBIT_SITE_ID?.trim();
  if (!host || !siteId) return null;
  return {
    scriptSrc: `${host}/api/script.js`,
    siteId,
  };
}

export function resolveGithubRepoUrl(env: NodeJS.ProcessEnv = process.env): string {
  return normalizeSiteUrl(env.GITHUB_REPO_URL) || 'https://github.com/darioguarascio/cryptobin.app';
}

export function siteHostFromUrl(siteUrl: string): string {
  if (!siteUrl) return 'localhost';
  try {
    return new URL(siteUrl).host;
  } catch {
    return 'localhost';
  }
}

export function resolveSmtpFrom(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.SMTP_FROM?.trim();
  if (explicit) return explicit;
  const siteUrl = resolveSiteUrl(env);
  if (!siteUrl) return 'noreply@localhost';
  try {
    return `noreply@${new URL(siteUrl).hostname}`;
  } catch {
    return 'noreply@localhost';
  }
}
