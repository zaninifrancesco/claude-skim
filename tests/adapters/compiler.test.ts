import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CompilerLinterAdapter } from '../../src/adapters/compiler.js';

const fixture = (name: string) => readFileSync(new URL(`../../fixtures/${name}.log`, import.meta.url), 'utf8');
const adapter = new CompilerLinterAdapter();

describe('compiler and linter', () => {
  it.each(['tsc --noEmit', 'npx tsc', 'eslint .', 'npx eslint src', 'ruff check .', 'flake8 src'])('matches %s', (command) => {
    expect(adapter.canHandle(command, '')).toBe(true);
  });
  it.each(['echo tsc', 'tsc-custom', 'ruff format .', 'eslint . && cat file', 'npm run lint'])('does not guess the compiler behind %s', (command) => {
    expect(adapter.canHandle(command, '')).toBe(false);
  });
  it('summarizes an explicitly clean compiler run', () => {
    expect(adapter.prune(fixture('tsc-passing')).condensedStdout).toBe('✅ No lint/type errors found');
  });
  it('keeps all TypeScript diagnostics including source snippets and related notes', () => {
    const errors = fixture('tsc-errors');
    const raw = fixture('tsc-passing').split('[12:00:01]')[0] + errors;
    const result = adapter.prune(raw);
    expect(result.condensedStdout).toBe(errors);
    expect(result.condensedStdout).toContain("An argument for 'reason' was not provided.");
  });
  it('preserves ESLint file headers, columns, rule names and warnings', () => {
    const errors = fixture('eslint-errors');
    const result = adapter.prune(errors);
    expect(result.condensedStdout).toBe(errors.slice(errors.indexOf('/Users/')));
  });
  it('never guesses success from empty or unknown output', () => {
    for (const raw of ['', 'Starting something\n', 'Fatal: plugin failed\n', 'All checks passed!\nWarning: unsafe configuration\n']) {
      expect(adapter.prune(raw).condensedStdout).toBe(raw);
    }
  });
  it('keeps all stderr diagnostics and estimates both streams', () => {
    const raw = fixture('tsc-passing');
    const stderr = fixture('tsc-errors');
    const result = adapter.prune(raw, stderr);
    expect(result.condensedStderr).toBe(stderr);
    expect(result.originalTokens).toBe(Math.ceil(raw.length / 3.5) + Math.ceil(stderr.length / 3.5));
  });
  it('does not delete noise-shaped lines inside error messages', () => {
    const raw = 'src/a.ts(1,1): error TS2322: wrong output\nFound 0 errors.\n> expected shell line\n';
    expect(adapter.prune(raw).condensedStdout).toBe(raw);
  });
});
