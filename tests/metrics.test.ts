import { describe, expect, it } from 'vitest';
import { estimateTokens, estimateDollarSavings } from '../src/utils/tokens.js';

describe('token estimates', () => {
  it.each(['', 'a', 'abcdefg', 'Expected: 401\nReceived: 200', '🙂 caffè', 'x'.repeat(1_000_000)])(
    'uses ceil(chars / 3.5), including empty and large input', (text) => {
      expect(estimateTokens(text)).toBe(Math.ceil(text.length / 3.5));
    },
  );

  it('uses the specified $3 per million baseline', () => {
    expect(estimateDollarSavings(0)).toBe(0);
    expect(estimateDollarSavings(1_000_000)).toBe(3);
    expect(estimateDollarSavings(54_210)).toBeCloseTo(0.16263);
  });
});
