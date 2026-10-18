import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PackageManagerAdapter } from '../../src/adapters/package-manager.js';

const fixture = (name: string) => readFileSync(new URL(`../../fixtures/${name}.log`, import.meta.url), 'utf8');
const adapter = new PackageManagerAdapter();

describe('package managers', () => {
  it.each(['npm i', 'npm install react', 'npm ci', 'pnpm i', 'pnpm install', 'yarn add react', 'yarn install', 'pip install pytest', 'pip3 install pytest', 'poetry add pytest', 'poetry install'])('matches %s', (command) => {
    expect(adapter.canHandle(command, '')).toBe(true);
  });
  it.each(['npm init', 'npm info react', 'echo npm install', 'yarn test', 'pip install-x', 'npm i && cat file', 'npm i | tail', 'npm i\ncat file'])('passes unrelated commands through: %s', (command) => {
    expect(adapter.canHandle(command, '')).toBe(false);
  });
  it('reduces npm progress and funding banners to two summary lines', () => {
    const result = adapter.prune(fixture('npm-install'));
    expect(result.condensedStdout).toBe('added 142 packages, and audited 143 packages in 3s\nfound 0 vulnerabilities');
    expect(result.tokensSaved).toBeGreaterThan(0);
  });
  it('keeps the complete error block and dependency resolution context', () => {
    const raw = fixture('npm-install-failing');
    const result = adapter.prune(raw);
    expect(result.condensedStdout).toContain(raw.slice(raw.indexOf('npm error code')));
    expect(result.condensedStdout).not.toContain('reify:');
    expect(result.condensedStdout).not.toContain('deprecated inflight');
  });
  it.each([
    ['Progress: resolved 50, reused 40, downloaded 10, added 3\nPackages: +3\nDone in 2.1s\n', 'Packages: +3\nDone in 2.1s'],
    ['yarn add v1.22.22\n[1/4] Resolving packages...\n[2/4] Fetching packages...\nsuccess Saved 3 new dependencies.\nDone in 1.2s.\n', 'success Saved 3 new dependencies.\nDone in 1.2s.'],
    ['Collecting pytest\nDownloading pytest-8.0.0.whl (100 kB)\nInstalling collected packages: pytest\nSuccessfully installed pytest-8.0.0\n', 'Successfully installed pytest-8.0.0'],
    ['Installing dependencies from lock file\nPackage operations: 1 install, 0 updates, 0 removals\n  - Installing pytest (8.0.0)\n', 'Package operations: 1 install, 0 updates, 0 removals'],
  ])('compresses recognized installer progress', (raw, expected) => {
    expect(adapter.prune(raw).condensedStdout).toBe(expected);
  });
  it('retains security summaries and unknown warnings', () => {
    const raw = '[########] reify:react: timing\n3 high severity vulnerabilities\nWARNING: package is unsafe\n';
    expect(adapter.prune(raw).condensedStdout).toContain('3 high severity vulnerabilities\nWARNING: package is unsafe');
  });
  it('keeps pip build tracebacks and noise-shaped text after an error', () => {
    const stderr = 'ERROR: Failed building wheel for example\nTraceback (most recent call last):\n  File "setup.py", line 12\nCollecting diagnostic from script\nRuntimeError: failed\n';
    expect(adapter.prune('Collecting example\n', stderr).condensedStderr).toBe(stderr);
  });
  it('leaves unknown formats and blank output unchanged', () => {
    expect(adapter.prune('custom installer says hello\n').condensedStdout).toBe('custom installer says hello\n');
    expect(adapter.prune('').condensedStdout).toBe('');
  });
});
