import type { EngineInterface, On } from 'claude-code';
import { describe, expect, it, vi } from 'vitest';
import { register } from '../hooks/register.js';

type Handler = ($: EngineInterface, event: Record<string, unknown>, next: (event: unknown) => Promise<unknown>) => Promise<unknown>;
function setup(stored: Record<string, unknown> = {}) {
  const hooks = new Map<string, Handler>();
  const on = vi.fn((name: string, matcher: unknown, hook?: unknown) => {
    hooks.set(name, (hook ?? matcher) as Handler);
    return { catch: vi.fn() };
  });
  const $ = {
    fs: { write: vi.fn().mockResolvedValue(undefined), read: vi.fn().mockResolvedValue('raw log') },
    ui: { status: vi.fn(), toast: vi.fn(), log: vi.fn() },
    store: {
      get: vi.fn(async (key: string) => stored[key]),
      set: vi.fn(async (key: string, value: unknown) => { stored[key] = value; }),
    },
    command: { register: vi.fn().mockResolvedValue({ command: 'skim' }) },
  };
  register(on as On, {});
  const call = async (name: string, event: Record<string, unknown> = {}, next = vi.fn().mockResolvedValue({})) => {
    const hook = hooks.get(name);
    if (!hook) throw new Error(`Missing hook ${name}`);
    return hook($ as unknown as EngineInterface, event, next);
  };
  return { $, hooks, call, on, stored };
}
const raw = ' ✓ returns expected value (1ms)\n'.repeat(100) + 'Tests: 100 passed, 100 total\n';

describe('host hooks', () => {
  it('registers the real host lifecycle and command APIs', async () => {
    const { $, hooks, call, on } = setup();
    expect([...hooks.keys()]).toEqual(['session.start', 'tool.call', 'turn.complete', 'classic.SessionEnd', 'command.run']);
    const next = vi.fn().mockResolvedValue({ cwd: '/project' });
    expect(await call('session.start', { cwd: '/project' }, next)).toEqual({ cwd: '/project' });
    expect(next).toHaveBeenCalledTimes(1);
    expect($.command.register).toHaveBeenCalledWith(expect.objectContaining({ name: 'skim' }));
    expect(on).toHaveBeenCalledWith('tool.call', { tool: 'Bash' }, expect.any(Function));
    expect(on).toHaveBeenCalledWith('command.run', { command: 'skim' }, expect.any(Function));
  });
  it('restores a paused user preference and saved lifetime metrics', async () => {
    const { $, call } = setup({ skim_enabled: false, skim_lifetime_metrics: { lifetimeTokensSaved: 1000, lifetimeRunsPruned: 2 } });
    await call('session.start');
    expect($.ui.status).toHaveBeenCalledWith('⚡ Skim: [Paused] (/skim toggle)');
    const input = { result: { stdout: raw, stderr: '', interrupted: false } };
    expect(await call('tool.call', { command: 'npm test' }, vi.fn().mockResolvedValue(input))).toBe(input);
    expect(await call('command.run', { args: 'stats' })).toMatchObject({ text: expect.stringContaining('Lifetime Savings: 1,000 tokens') });
  });
  it('preserves continuation even if storage or UI initialization fails', async () => {
    const { $, call } = setup();
    $.store.get.mockRejectedValue(new Error('unavailable'));
    $.ui.status.mockImplementation(() => { throw new Error('UI closed'); });
    const next = vi.fn().mockResolvedValue({ cwd: '/project' });
    await expect(call('session.start', {}, next)).resolves.toEqual({ cwd: '/project' });
    expect($.command.register).toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });
  it('uses fresh session metrics and tolerates malformed stored values', async () => {
    const { call } = setup({ skim_enabled: 'false', skim_lifetime_metrics: { lifetimeTokensSaved: NaN, lifetimeRunsPruned: -4 } });
    await call('session.start');
    expect(await call('command.run', { args: 'stats' })).toMatchObject({ text: expect.stringContaining('Lifetime Savings: 0 tokens') });
  });
  it('prunes a tool result and persists totals without double counting on close', async () => {
    const { $, call, stored } = setup({ skim_lifetime_metrics: { lifetimeTokensSaved: 500, lifetimeRunsPruned: 2 } });
    await call('session.start');
    const input = { result: { stdout: raw, stderr: '', interrupted: false }, ref: 7 };
    const output = await call('tool.call', { command: 'npm test' }, vi.fn().mockResolvedValue(input));
    expect(output).toMatchObject({ result: { stdout: expect.stringContaining('Full raw log:') } });
    await call('turn.complete');
    const first = structuredClone(stored.skim_lifetime_metrics);
    expect(first).toMatchObject({ lifetimeTokensSaved: expect.any(Number), lifetimeRunsPruned: 3 });
    await call('classic.SessionEnd');
    expect(stored.skim_lifetime_metrics).toEqual(first);
    expect($.ui.status).toHaveBeenLastCalledWith(expect.stringContaining('1 pruned'));
  });
  it('returns the pruned result even when the status UI fails', async () => {
    const { $, call } = setup();
    await call('session.start');
    $.ui.status.mockImplementation(() => { throw new Error('closed'); });
    const output = await call('tool.call', { command: 'npm test' }, vi.fn().mockResolvedValue({ result: { stdout: raw, stderr: '', interrupted: false } }));
    expect(output).toMatchObject({ result: { stdout: expect.stringContaining('Full raw log:') } });
  });
  it('does not overwrite lifetime metrics when startup storage cannot be read', async () => {
    const { $, call } = setup();
    $.store.get.mockRejectedValue(new Error('unavailable'));
    await call('session.start');
    await call('turn.complete');
    await call('classic.SessionEnd');
    expect($.store.set).not.toHaveBeenCalled();
  });
  it('does not rerun a failed Bash continuation', async () => {
    const { call } = setup();
    const next = vi.fn().mockRejectedValue(new Error('tool failed'));
    await expect(call('tool.call', { command: 'npm test' }, next)).rejects.toThrow('tool failed');
    expect(next).toHaveBeenCalledTimes(1);
  });
  it('turns slash command errors into a readable response', async () => {
    const { $, call } = setup();
    $.store.set.mockRejectedValue(new Error('disk full'));
    expect(await call('command.run', { args: 'toggle' })).toMatchObject({ text: expect.stringContaining('could not complete') });
  });
  it('does not block turn completion if persistence fails', async () => {
    const { $, call } = setup();
    $.store.set.mockRejectedValue(new Error('disk full'));
    const next = vi.fn().mockResolvedValue({ done: true });
    await expect(call('turn.complete', {}, next)).resolves.toEqual({ done: true });
    expect(next).toHaveBeenCalledTimes(1);
  });
});
