import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { JestVitestAdapter } from '../../src/adapters/jest-vitest.js';
import { estimateTokens } from '../../src/utils/tokens.js';

const fixture = (name: string) => readFileSync(new URL(`../../fixtures/${name}.log`, import.meta.url), 'utf8');
const adapter = new JestVitestAdapter();

describe('Jest / Vitest', () => {
  it.each(['jest', 'npx jest --runInBand', 'vitest run', 'npx vitest', 'npm test', 'npm run test:unit', 'pnpm test', 'yarn test'])('matches %s', (command) => {
    expect(adapter.canHandle(command, '')).toBe(true);
  });

  it.each(['echo jest', 'cat jest.log', 'my-vitest', 'jest-unknown', 'npm test-unknown', 'npm install', 'npm test && cat secrets.txt', 'jest | cat', 'npm test; echo diagnostic', 'npm test\ncat secret'])('does not route unrelated or compound commands: %s', (command) => {
    expect(adapter.canHandle(command, '')).toBe(false);
  });

  it.each(['jest-passing', 'vitest-passing'])('condenses %s to at most two lines', (name) => {
    const result = adapter.prune(fixture(name));
    expect(result.condensedStdout.split('\n').length).toBeLessThanOrEqual(2);
    expect(result.condensedStdout).toContain('passed');
    expect(result.condensedStdout).toContain(name === 'jest-passing' ? '11' : '9');
    expect(result.condensedStdout).toContain(name === 'jest-passing' ? '1.458' : '250ms');
  });

  it('removes at least 90% of tokens from 200 passing tests', () => {
    const raw = Array.from({ length: 200 }, (_, i) => `  ✓ test number ${i} returns expected value (2 ms)`).join('\n') + '\nTest Suites: 1 passed, 1 total\nTests: 200 passed, 200 total\nTime: 1.2 s\n';
    const result = adapter.prune(raw);
    expect(result.tokensSaved / result.originalTokens).toBeGreaterThanOrEqual(0.9);
    expect(result.condensedStdout.split('\n').length).toBeLessThanOrEqual(2);
  });

  it.each(['jest-failing', 'vitest-failing'])('preserves the entire diagnostic block from %s', (name) => {
    const raw = fixture(name);
    const result = adapter.prune(raw);
    const start = raw.indexOf(' FAIL ');
    const end = raw.indexOf(name === 'jest-failing' ? '\n PASS ' : '\n Test Files', start);
    expect(result.condensedStdout).toContain(raw.slice(start, end));
    expect(result.condensedStdout).not.toMatch(/^\s*(✓|PASS)\s/m);
    expect(result.condensedStdout).toContain('1 failed');
    expect(result.condensedStdout).toContain(':36:24');
  });

  it('preserves checkmarks and PASS text within diagnostics', () => {
    const raw = ' ✓ passing.test.ts (1 test)\n FAIL failing.test.ts\nExpected output:\n  ✓ retain this assertion value\n PASS this is an expected string\nError: wrong result\nTests: 1 failed, 1 passed\n';
    expect(adapter.prune(raw).condensedStdout).toContain(raw.slice(raw.indexOf(' FAIL')));
  });

  it('keeps stderr failures even when stdout has a passing summary', () => {
    const stderr = 'Error: teardown failed\n  at src/cleanup.ts:42:1\n';
    const result = adapter.prune(fixture('jest-passing'), stderr);
    expect(result.condensedStderr).toBe(stderr);
  });

  it('parses Jest summaries emitted entirely to stderr', () => {
    const result = adapter.prune('', fixture('jest-passing'));
    expect(result.condensedStdout).toBe('');
    expect(result.condensedStderr).toContain('11');
    expect(result.condensedStderr?.split('\n').length).toBeLessThanOrEqual(2);
  });

  it('handles ANSI colors and CRLF while keeping diagnostics verbatim', () => {
    const raw = fixture('jest-failing').replaceAll(' FAIL ', '\u001b[31m FAIL\u001b[0m ').replaceAll('\n', '\r\n');
    const result = adapter.prune(raw);
    expect(result.condensedStdout).toContain('Expected: 401\r\n    Received: 200');
    expect(result.condensedStdout).toContain('\u001b[31m FAIL\u001b[0m');
    expect(result.condensedStdout).not.toContain('✓ adds two numbers');
  });

  it.each(['', 'unrecognized format\nkeep everything\n', ' ✓ pass\nError: setup crashed\n  at src/setup.ts:2:1\n', 'Tests: 1 passed\nWarning: resource leak\n'])('passes through ambiguous input', (raw) => {
    expect(adapter.prune(raw).condensedStdout).toBe(raw);
  });

  it('reports exact character-based estimates and line counts', () => {
    const raw = fixture('jest-passing');
    const stderr = 'diagnostic\n';
    const result = adapter.prune(raw, stderr);
    expect(result.originalTokens).toBe(estimateTokens(raw) + estimateTokens(stderr));
    expect(result.condensedTokens).toBe(estimateTokens(result.condensedStdout) + estimateTokens(stderr));
    expect(result.tokensSaved).toBe(result.originalTokens - result.condensedTokens);
    expect(result.linesRemoved).toBe(raw.split('\n').length - result.condensedStdout.split('\n').length);
    expect(result.matchedAdapter).toBe(adapter.name);
    expect(adapter.prune('unknown').condensedStderr).toBeUndefined();
  });
});

// Passing summaries must retain skipped/todo counts and snapshot results too.
it('keeps skipped counts, todos and snapshot information', () => {
  const raw = ' ✓ passing.test.ts (3 tests)\nTests: 2 passed, 1 skipped, 1 todo, 4 total\nSnapshots: 1 passed, 1 total\n';
  const result = adapter.prune(raw);
  expect(result.condensedStdout).toContain('1 skipped');
  expect(result.condensedStdout).toContain('1 todo');
  expect(result.condensedStdout).toContain('Snapshots: 1 passed, 1 total');
});
