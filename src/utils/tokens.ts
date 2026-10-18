export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

export function estimateDollarSavings(tokensSaved: number): number {
  return tokensSaved / 1_000_000 * 3;
}
