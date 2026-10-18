import { describe, expect, it, vi } from 'vitest';
import { plainLine, pruneStreams } from '../../src/adapters/shared.js';

describe('adapter safety', () => {
  it('returns both original streams when either parser throws', () => {
    const condense = vi.fn().mockReturnValueOnce('short').mockImplementationOnce(() => { throw new Error('parser crash'); });
    const result = pruneStreams('test', 'long stdout\n'.repeat(10), 'long stderr\n'.repeat(10), condense);
    expect(result.condensedStdout).toBe('long stdout\n'.repeat(10));
    expect(result.condensedStderr).toBe('long stderr\n'.repeat(10));
    expect(result.tokensSaved).toBe(0);
    expect(result.linesRemoved).toBe(0);
  });

  it('does not enlarge either stream', () => {
    const result = pruneStreams('test', 'short', '', () => 'much longer text');
    expect(result.condensedStdout).toBe('short');
    expect(result.condensedStderr).toBe('');
    expect(result.tokensSaved).toBe(0);
  });

  it('compacts both streams and counts all removed lines', () => {
    const result = pruneStreams('test', 'one\ntwo\nthree', 'four\nfive\nsix', (text) => text.split('\n')[0]!);
    expect(result.condensedStdout).toBe('one');
    expect(result.condensedStderr).toBe('four');
    expect(result.linesRemoved).toBe(4);
  });

  it('strips only ANSI control codes and a terminal CR for matching', () => {
    expect(plainLine('\u001b[31mFAIL\u001b[0m test.ts\r')).toBe('FAIL test.ts');
    expect(plainLine('Expected: café 🙂')).toBe('Expected: café 🙂');
  });
});
