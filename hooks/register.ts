import type { EngineInterface, Register } from 'claude-code';
import { handleSkimCommand, formatStatus } from '../src/commands.js';
import { processToolCall, MIN_LINES_THRESHOLD } from '../src/engine.js';
import { createSessionMetrics, type LifetimeTotals, type SessionMetrics } from '../src/metrics.js';
import { estimateDollarSavings } from '../src/utils/tokens.js';

function logFailure($: EngineInterface): void {
  try { $.ui.log('Skim: host operation failed; continuing the session.'); } catch { /* The UI may already be closed. */ }
}
const validCount = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;

async function persist($: EngineInterface, state: SessionMetrics, lifetime: LifetimeTotals): Promise<void> {
  // shortcut: totals assume one active session per store; use atomic updates for concurrent sessions.
  const tokens = lifetime.tokensSaved + state.tokensSaved;
  await $.store.set('skim_lifetime_metrics', {
    lifetimeTokensSaved: tokens,
    lifetimeRunsPruned: lifetime.runsPruned + state.runsPruned,
    lifetimeDollarSavings: estimateDollarSavings(tokens),
    lastPrunedTimestamp: state.lastPrunedTimestamp,
    userConfig: { enabled: state.enabled, minLineThreshold: MIN_LINES_THRESHOLD, archiveRetentionDays: 7, showStatusBadge: true },
  });
}

export const register: Register = (on) => {
  const state = createSessionMetrics();
  let restored = false;
  const lifetime: LifetimeTotals = { tokensSaved: 0, runsPruned: 0 };

  on('session.start', async ($, event, next) => {
    try {
      const [saved, enabled] = await Promise.all([$.store.get('skim_lifetime_metrics'), $.store.get('skim_enabled')]);
      if (saved && typeof saved === 'object') {
        lifetime.tokensSaved = validCount('lifetimeTokensSaved' in saved ? saved.lifetimeTokensSaved : undefined);
        lifetime.runsPruned = validCount('lifetimeRunsPruned' in saved ? saved.lifetimeRunsPruned : undefined);
        state.lastPrunedTimestamp = validCount('lastPrunedTimestamp' in saved ? saved.lastPrunedTimestamp : undefined);
      }
      if (typeof enabled === 'boolean') state.enabled = enabled;
      restored = true;
    } catch {
      state.enabled = false;
      logFailure($);
    }
    try {
      await $.command.register({ name: 'skim', description: 'Manage local output pruning and inspect token savings', argumentHint: '[stats|raw|toggle|help]' });
    } catch { logFailure($); }
    try { $.ui.status(formatStatus(state)); } catch { logFailure($); }
    return next(event);
  });

  on('tool.call', { tool: 'Bash' }, async ($, event, next) => {
    const answer = await next(event);
    const result = await processToolCall({
      fs: { write: (path, text) => $.fs.write(path, text) },
      ui: { log: (text) => $.ui.log(text) },
    }, event.command, answer, state);
    if (result !== answer) {
      try { $.ui.status(formatStatus(state)); } catch { logFailure($); }
    }
    return result;
  });

  on('turn.complete', async ($, event, next) => {
    try { if (restored) await persist($, state, lifetime); } catch { logFailure($); }
    try { $.ui.status(formatStatus(state)); } catch { logFailure($); }
    return next(event);
  });

  // The shipped API exposes session shutdown through the classic lifecycle event.
  on('classic.SessionEnd', async ($, event, next) => {
    try { if (restored) await persist($, state, lifetime); } catch { logFailure($); }
    return next(event);
  });

  on('command.run', { command: 'skim' }, async ($, event) => {
    try {
      return { text: await handleSkimCommand({
        fs: { read: (path) => $.fs.read(path) },
        store: { set: (key, value) => $.store.set(key, value) },
        ui: { status: (text) => $.ui.status(text), toast: (text) => $.ui.toast(text) },
      }, event.args, state, lifetime) };
    } catch {
      logFailure($);
      return { text: 'Skim: could not complete this command. See the session log for details.' };
    }
  });
};
