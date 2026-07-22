import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('install.sh', () => {
  it('is served from public and matches scripts/install.sh', () => {
    const source = readFileSync(join(root, 'scripts', 'install.sh'), 'utf8');
    const published = readFileSync(join(root, 'apps', 'web', 'public', 'install.sh'), 'utf8');
    assert.equal(published, source);
  });

  it('uses a strict shell and documents curl flags', () => {
    const source = readFileSync(join(root, 'scripts', 'install.sh'), 'utf8');
    assert.ok(source.startsWith('#!/bin/sh'));
    assert.match(source, /set -eu/);
    assert.match(source, /curl -fsSL/);
  });

  it('documents cryptobin secret usage', () => {
    const source = readFileSync(join(root, 'scripts', 'install.sh'), 'utf8');
    assert.match(source, /cryptobin secret/);
  });

  it('uses printf %b for terminal styling', () => {
    const source = readFileSync(join(root, 'scripts', 'install.sh'), 'utf8');
    assert.match(source, /printf '\\033'/);
    assert.match(source, /say\(\)/);
    assert.match(source, /c_cli_build_ready/);
  });
});
