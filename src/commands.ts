import type { EngineInterface } from 'claude-code';
import type { LifetimeTotals, SessionMetrics } from './metrics.js';
import { estimateDollarSavings } from './utils/tokens.js';

type CommandHost = {
  fs: Pick<EngineInterface['fs'], 'read'>;
  store: Pick<EngineInterface['store'], 'set'>;
  ui: Pick<EngineInterface['ui'], 'status' | 'toast'>;
};
const number = (value: number) => value.toLocaleString('en-US');

export function formatStatus(state: SessionMetrics): string {
  if (!state.enabled) return '⚡ Skim: [Paused] (/skim toggle)';
  if (!state.tokensSaved) return '⚡ Skim: Active (monitoring stdout)';
  const tokens = state.tokensSaved >= 1000 ? `${(state.tokensSaved / 1000).toFixed(1)}k` : String(state.tokensSaved);
  return `⚡ Skim: -${tokens} tokens (~$${estimateDollarSavings(state.tokensSaved).toFixed(2)}) · ${state.runsPruned} pruned`;
}

export async function handleSkimCommand($: CommandHost, args: string, state: SessionMetrics, lifetime: LifetimeTotals): Promise<string> {
  switch (args.trim()) {
    case '':
    case 'stats': {
      const reduction = state.tokensBeforePruning ? state.tokensSaved / state.tokensBeforePruning * 100 : 0;
      const total = lifetime.tokensSaved + state.tokensSaved;
      return [
        '⚡ Skim Savings Report',
        `Session Tokens Saved: ${number(state.tokensSaved)} tokens (~$${estimateDollarSavings(state.tokensSaved).toFixed(2)})`,
        `Session Logs Pruned: ${state.runsPruned} command runs`,
        `Average Reduction: ${reduction.toFixed(1)}%`,
        'Breakdown by Adapter:',
        ...Object.entries(state.adapterBreakdown).map(([name, stats]) => `  ${name}: ${stats.runs} runs (-${number(stats.tokensSaved)} tokens)`),
        `Lifetime Savings: ${number(total)} tokens (~$${estimateDollarSavings(total).toFixed(2)}) across ${lifetime.runsPruned + state.runsPruned} runs`,
        'Archive Directory: .claude/skim/runs/',
      ].join('\n');
    }
    case 'raw':
      if (!state.lastRawLog) return 'Skim: No output has been pruned in this session.';
      return `${state.lastRawLog}\n${(await $.fs.read(state.lastRawLog)).split('\n').slice(0, 20).join('\n')}`;
    case 'toggle': {
      const enabled = !state.enabled;
      await $.store.set('skim_enabled', enabled);
      state.enabled = enabled;
      const message = enabled ? 'Skim: Active. Pruning enabled.' : 'Skim: Paused. Raw stdout will pass to Claude untouched.';
      $.ui.toast(message);
      $.ui.status(formatStatus(state));
      return message;
    }
    default:
      return '/skim stats — session and lifetime savings\n/skim raw — latest raw log and first 20 lines\n/skim toggle — pause or resume pruning\n/skim help — show this help';
  }
}
