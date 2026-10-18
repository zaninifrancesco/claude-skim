import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GenericFallbackAdapter } from '../../src/adapters/fallback.js';

const adapter = new GenericFallbackAdapter();
const raw = readFileSync(new URL('../../fixtures/fallback.log', import.meta.url), 'utf8');

describe('explicit generic fallback', () => {
  it('keeps the first ten and last twenty-five lines of 500-line output', () => {
    const result = adapter.prune(raw);
    const lines = raw.split('\n');
    expect(result.condensedStdout).toBe([...lines.slice(0, 10), `... [skim: ${lines.length - 35} lines omitted] ...`, ...lines.slice(-25)].join('\n'));
    expect(result.linesRemoved).toBe(lines.length - 36);
  });
  it('leaves short input unchanged', () => {
    expect(adapter.canHandle('anything', 'short')).toBe(false);
    expect(adapter.canHandle('anything', raw)).toBe(true);
    expect(adapter.prune('short\n').condensedStdout).toBe('short\n');
  });
  it.each(['Error: failure', 'FAIL test', 'AssertionError: mismatch', 'thread panicked at line 3', '  at src/a.ts:12:1', 'warning: dangerous setting'])('keeps all output containing diagnostics: %s', (diagnostic) => {
    const text = raw.replace('build progress line 100', diagnostic);
    expect(adapter.prune(text).condensedStdout).toBe(text);
  });
});
