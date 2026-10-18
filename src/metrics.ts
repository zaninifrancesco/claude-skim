export interface SessionMetrics {
  sessionStartTime: number;
  tokensBeforePruning: number;
  tokensAfterPruning: number;
  tokensSaved: number;
  runsPruned: number;
  runsPassedThrough: number;
  enabled: boolean;
  adapterBreakdown: Record<string, { runs: number; tokensSaved: number }>;
  lastRawLog?: string;
  lastPrunedTimestamp: number;
}

export function createSessionMetrics(): SessionMetrics {
  return {
    sessionStartTime: Date.now(),
    tokensBeforePruning: 0,
    tokensAfterPruning: 0,
    tokensSaved: 0,
    runsPruned: 0,
    runsPassedThrough: 0,
    enabled: true,
    adapterBreakdown: {},
    lastPrunedTimestamp: 0,
  };
}
