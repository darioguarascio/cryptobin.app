import { describe, expect, it } from 'vitest';
import {
  resolveGithubRepoUrl,
  resolveRybbitConfig,
  resolveSiteUrl,
  resolveSmtpFrom,
  siteHostFromUrl,
} from './siteEnv';

describe('siteEnv', () => {
  it('resolves Rybbit when host and site id are set', () => {
    expect(
      resolveRybbitConfig({
        RYBBIT_HOST: 'https://t.surl.it/',
        RYBBIT_SITE_ID: '9',
      }),
    ).toEqual({
      scriptSrc: 'https://t.surl.it/api/script.js',
      siteId: '9',
    });
  });

  it('returns null when Rybbit env is incomplete', () => {
    expect(resolveRybbitConfig({ RYBBIT_HOST: 'https://t.surl.it' })).toBeNull();
    expect(resolveRybbitConfig({ RYBBIT_SITE_ID: '9' })).toBeNull();
  });

  it('uses SITE_URL when set', () => {
    expect(resolveSiteUrl({ SITE_URL: 'https://secrets.example.com/' })).toBe(
      'https://secrets.example.com',
    );
  });

  it('falls back to localhost in non-production', () => {
    expect(resolveSiteUrl({ NODE_ENV: 'development' })).toBe('http://localhost:4321');
  });

  it('does not default SITE_URL in production', () => {
    expect(resolveSiteUrl({ NODE_ENV: 'production' })).toBe('');
  });

  it('derives SMTP from address from site hostname', () => {
    expect(
      resolveSmtpFrom({
        SITE_URL: 'https://secrets.example.com',
      }),
    ).toBe('noreply@secrets.example.com');
  });

  it('uses explicit SMTP_FROM when set', () => {
    expect(
      resolveSmtpFrom({
        SITE_URL: 'https://secrets.example.com',
        SMTP_FROM: 'mail@example.com',
      }),
    ).toBe('mail@example.com');
  });

  it('parses site host for UI copy', () => {
    expect(siteHostFromUrl('https://secrets.example.com')).toBe('secrets.example.com');
  });

  it('resolves GitHub repo URL from env', () => {
    expect(resolveGithubRepoUrl({ GITHUB_REPO_URL: 'https://github.com/acme/cryptobin' })).toBe(
      'https://github.com/acme/cryptobin',
    );
  });
});
