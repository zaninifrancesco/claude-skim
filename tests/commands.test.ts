import { describe, expect, it, vi } from 'vitest';
import { handleSkimCommand, formatStatus } from '../src/commands.js';
import { createSessionMetrics } from '../src/metrics.js';

const host = () => ({
  fs: { read: vi.fn().mockResolvedValue(Array.from({ length: 30 }, (_, i) => `line ${i}`).join('\n')) },
  store: { set: vi.fn().mockResolvedValue(undefined) },
  ui: { status: vi.fn(), toast: vi.fn() },
});

describe('/skim', () => {
  it('reports session, lifetime, adapter and zero-safe reduction statistics', async () => {
    const state = createSessionMetrics();
    const $ = host();
    expect(await handleSkimCommand($, '', state, { tokensSaved: 100, runsPruned: 1 })).toContain('Average Reduction: 0.0%');
    state.tokensBeforePruning = 1000;
    state.tokensAfterPruning = 250;
    state.tokensSaved = 750;
    state.runsPruned = 2;
    state.adapterBreakdown['Jest / Vitest'] = { runs: 2, tokensSaved: 750 };
    const report = await handleSkimCommand($, 'stats', state, { tokensSaved: 100, runsPruned: 1 });
    expect(report).toContain('Average Reduction: 75.0%');
    expect(report).toContain('Jest / Vitest: 2 runs (-750 tokens)');
    expect(report).toContain('Lifetime Savings: 850 tokens');
    expect(report).toContain('.claude/skim/runs/');
  });
  it('renders an aligned savings card with the requested labels', async () => {
    const state = createSessionMetrics();
    state.tokensSaved = 54_210;
    state.runsPruned = 14;
    state.tokensBeforePruning = 69_145;
    const report = await handleSkimCommand(host(), 'stats', state, { tokensSaved: 1_365_790, runsPruned: 100 });
    expect(report).toContain('Session Tokens Saved: 54,210 tokens (~$0.16)');
    expect(report).toContain('Session Logs Skimmed: 14 command runs');
    expect(report).toContain('Lifetime Savings: 1.42M tokens (~$4.26 saved)');
    expect(report.startsWith('╭')).toBe(true);
    expect(report.trimEnd().endsWith('╯')).toBe(true);
    const widths = report.split('\n').map((line) => [...line].reduce((width, ch) => width + (ch === '⚡' ? 2 : 1), 0));
    expect(new Set(widths).size).toBe(1);
  });
  it('persists toggle state before updating the UI', async () => {
    const $ = host();
    const state = createSessionMetrics();
    expect(await handleSkimCommand($, 'toggle', state, { tokensSaved: 0, runsPruned: 0 })).toContain('Paused');
    expect(state.enabled).toBe(false);
    expect($.store.set).toHaveBeenCalledWith('skim_enabled', false);
    expect($.ui.status).toHaveBeenLastCalledWith('⚡ Skim: [Paused] (/skim toggle)');
    await handleSkimCommand($, 'toggle', state, { tokensSaved: 0, runsPruned: 0 });
    expect(state.enabled).toBe(true);
  });
  it('keeps the previous enabled state if persistence fails', async () => {
    const $ = host();
    $.store.set.mockRejectedValue(new Error('disk full'));
    const state = createSessionMetrics();
    await expect(handleSkimCommand($, 'toggle', state, { tokensSaved: 0, runsPruned: 0 })).rejects.toThrow('disk full');
    expect(state.enabled).toBe(true);
  });
  it('shows the latest archive path and complete contents', async () => {
    const $ = host();
    const state = createSessionMetrics();
    expect(await handleSkimCommand($, 'raw', state, { tokensSaved: 0, runsPruned: 0 })).toContain('No output');
    state.lastRawLog = '.claude/skim/runs/run-123-abc.log';
    const text = await handleSkimCommand($, 'raw', state, { tokensSaved: 0, runsPruned: 0 });
    expect(text).toContain(state.lastRawLog);
    expect(text).toContain('line 19');
    expect(text).toContain('line 29');
    expect($.fs.read).toHaveBeenCalledWith(state.lastRawLog);
  });
  it('provides help for unsupported subcommands', async () => {
    const text = await handleSkimCommand(host(), 'unknown', createSessionMetrics(), { tokensSaved: 0, runsPruned: 0 });
    for (const command of ['stats', 'raw', 'toggle', 'help']) expect(text).toContain(`/skim ${command}`);
  });
  it('formats active, paused and savings status badges', () => {
    const state = createSessionMetrics();
    expect(formatStatus(state)).toBe('⚡ Skim: Active (monitoring stdout)');
    state.tokensSaved = 48200;
    state.runsPruned = 12;
    expect(formatStatus(state)).toBe('⚡ Skim: -48.2k tokens (~$0.14) · 12 logs skimmed');
  });
});
