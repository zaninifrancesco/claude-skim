# 04 - State & Metrics Specification

## 1. Token Estimation Heuristics

To keep the plugin **100% local, zero-dependency, and ultra-fast (< 1ms)**, token counts are estimated using an empirical character-and-word heuristic tailored for technical CLI text:

```typescript
export function estimateTokens(text: string): number {
  if (!text || text.length === 0) return 0;
  // Code and stack traces have high symbol density; empirical ratio ~ 3.5 chars per token
  return Math.ceil(text.length / 3.5);
}
```

Dollar savings calculation uses the standard Claude Sonnet pricing baseline ($3.00 / 1M prompt input tokens):
$$\text{Dollar Savings} = \frac{\text{Tokens Saved}}{1,000,000} \times \$3.00$$

---

## 2. In-Memory Session State

Stored in memory within `hooks/register.ts` during an active Claude Code session:

```typescript
interface SessionMetrics {
  sessionStartTime: number;
  tokensBeforePruning: number;
  tokensAfterPruning: number;
  tokensSaved: number;
  runsPruned: number;
  runsPassedThrough: number;
  enabled: boolean;
  adapterBreakdown: Record<string, { runs: number; tokensSaved: number }>;
}
```

---

## 3. Persistent Store Schema (`$.store`)

Saved across sessions so developers can see lifetime statistics (e.g., "Skim has saved you 1.2M tokens across 42 sessions"):

```typescript
interface PersistentStoreData {
  lifetimeTokensSaved: number;
  lifetimeRunsPruned: number;
  lifetimeDollarSavings: number;
  lastPrunedTimestamp: number;
  userConfig: {
    enabled: boolean;
    minLineThreshold: number; // default: 35
    archiveRetentionDays: number; // default: 7
    showStatusBadge: boolean; // default: true
  };
}
```

Key names:
- `'skim_lifetime_metrics'`: Serialized `PersistentStoreData`
- `'skim_enabled'`: boolean toggle
