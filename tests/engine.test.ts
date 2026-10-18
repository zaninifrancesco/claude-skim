import type { ToolCallResult } from 'claude-code';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { processToolCall, MIN_LINES_THRESHOLD } from '../src/engine.js';
import { createSessionMetrics } from '../src/metrics.js';
import { JestVitestAdapter } from '../src/adapters/jest-vitest.js';
import { estimateTokens } from '../src/utils/tokens.js';

const raw = Array.from({ length: 80 }, (_, i) => `  ✓ test number ${i} returns expected value (1 ms)`).join('\n') + '\nTest Suites: 1 passed, 1 total\nTests: 80 passed, 80 total\nTime: 1.0 s\n';
const answer = (stdout = raw, stderr = '') => ({ result: { stdout, stderr, interrupted: false }, ref: 42, text: 'old host rendering', context: ['keep this context'] });
const host = () => ({ fs: { write: vi.fn().mockResolvedValue(undefined) }, ui: { log: vi.fn() } });
function stdout(value: ToolCallResult<'Bash'>): string {
  if (value.isError || value.deny !== undefined) throw new Error('Unexpected error answer');
  return value.result.stdout;
}
afterEach(() => vi.restoreAllMocks());

describe('pruning engine', () => {
  it('routes Java failures, archives the exact log and counts Java savings', async () => {
    const raw = readFileSync(new URL('../fixtures/mvn-test-failing.log', import.meta.url), 'utf8');
    const $ = host();
    const state = createSessionMetrics();
    const input = { result: { ...answer(raw).result, exitCode: 1 } };
    const output = await processToolCall($, 'mvn test', input, state);
    expect(stdout(output)).toContain('AuthTokenTest.java:42');
    expect(stdout(output)).toContain(`Full raw log: ${state.lastRawLog}`);
    expect($.fs.write).toHaveBeenCalledWith(state.lastRawLog, raw);
    expect(state.adapterBreakdown['Java (Maven / Gradle)']?.runs).toBe(1);
  });
  it('archives the exact raw streams before returning a modified result', async () => {
    const $ = host();
    const state = createSessionMetrics();
    const input = answer(raw, 'warning from teardown\n');
    const output = await processToolCall($, 'npm test', input, state);
    expect(output).not.toBe(input);
    const path = $.fs.write.mock.calls[0]?.[0] as string;
    expect(path).toMatch(/^\.claude\/skim\/runs\/run-/);
    expect($.fs.write).toHaveBeenCalledWith(path, raw + input.result.stderr);
    expect(stdout(output)).toContain(`Full raw log: ${path}`);
    expect(output).toMatchObject({ result: { stderr: input.result.stderr, interrupted: false }, context: ['keep this context'] });
    expect(output).not.toHaveProperty('ref');
    expect(output).not.toHaveProperty('text');
    expect(input.ref).toBe(42);
    expect(state.runsPruned).toBe(1);
    expect(state.lastRawLog).toBe(path);
    const actualAfter = estimateTokens(stdout(output)) + estimateTokens(input.result.stderr);
    expect(state.tokensAfterPruning).toBe(actualAfter);
    expect(state.tokensSaved).toBe(estimateTokens(raw) + estimateTokens(input.result.stderr) - actualAfter);
    expect(state.adapterBreakdown['Jest / Vitest']?.runs).toBe(1);
  });

  it.each(['cat logs', 'curl localhost', 'unknown build', 'npm test && cat secret'])('passes %s through by identity', async (command) => {
    const $ = host();
    const state = createSessionMetrics();
    const input = answer();
    expect(await processToolCall($, command, input, state)).toBe(input);
    expect($.fs.write).not.toHaveBeenCalled();
    expect(state.runsPassedThrough).toBe(1);
  });

  it('uses the mandatory thirty-line threshold and the character floor', async () => {
    expect(MIN_LINES_THRESHOLD).toBe(30);
    for (const text of ['x'.repeat(4000), 'short\n'.repeat(29), ' ✓ a test\n'.repeat(35)]) {
      const $ = host();
      const input = answer(text);
      expect(await processToolCall($, 'npm test', input, createSessionMetrics())).toBe(input);
      expect($.fs.write).not.toHaveBeenCalled();
    }
  });

  it('bypasses disabled sessions, denied calls and hard tool errors', async () => {
    const $ = host();
    const state = createSessionMetrics();
    state.enabled = false;
    const input = answer();
    expect(await processToolCall($, 'npm test', input, state)).toBe(input);
    const denied = { deny: '' };
    expect(await processToolCall($, 'npm test', denied, createSessionMetrics())).toBe(denied);
    const failed = { isError: true as const, result: 'permission denied' };
    expect(await processToolCall($, 'npm test', failed, createSessionMetrics())).toBe(failed);
    expect($.fs.write).not.toHaveBeenCalled();
  });

  it.each([
    { interrupted: true }, { isImage: true }, { backgroundTaskId: 'task-1' },
    { persistedOutputPath: '/tmp/full.log' }, { rawOutputPath: '/tmp/raw.log' },
    { structuredContent: [{ type: 'image' }] },
  ])('keeps incomplete, externalized or structured answers unchanged: %o', async (fields) => {
    const input = { result: { ...answer().result, ...fields } };
    const $ = host();
    expect(await processToolCall($, 'npm test', input, createSessionMetrics())).toBe(input);
    expect($.fs.write).not.toHaveBeenCalled();
  });

  it('passes binary and base64 data through', async () => {
    for (const text of [raw + '\0', Buffer.from('x'.repeat(5000)).toString('base64') + '\n'.repeat(40)]) {
      const input = answer(text);
      const $ = host();
      expect(await processToolCall($, 'npm test', input, createSessionMetrics())).toBe(input);
      expect($.fs.write).not.toHaveBeenCalled();
    }
  });

  it('passes hard system errors through even when a runner summary is present', async () => {
    const input = answer(raw, 'Permission denied: cannot open test cache\n');
    const $ = host();
    expect(await processToolCall($, 'npm test', input, createSessionMetrics())).toBe(input);
    expect($.fs.write).not.toHaveBeenCalled();
  });
  it('does not change malformed runtime results', async () => {
    const input = { result: { stdout: 42 } } as unknown as ToolCallResult<'Bash'>;
    const $ = host();
    expect(await processToolCall($, 'npm test', input, createSessionMetrics())).toBe(input);
  });

  it('passes through when parsing throws, even if logging also fails', async () => {
    vi.spyOn(JestVitestAdapter.prototype, 'prune').mockImplementation(() => { throw new Error('bad parser'); });
    const $ = host();
    $.ui.log.mockImplementation(() => { throw new Error('UI closed'); });
    const state = createSessionMetrics();
    const input = answer();
    expect(await processToolCall($, 'npm test', input, state)).toBe(input);
    expect($.fs.write).not.toHaveBeenCalled();
    expect(state.runsPruned).toBe(0);
  });

  it('passes through if the archive cannot be written', async () => {
    const $ = host();
    $.fs.write.mockRejectedValue(new Error('disk full'));
    const state = createSessionMetrics();
    const input = answer();
    expect(await processToolCall($, 'npm test', input, state)).toBe(input);
    expect(state.tokensSaved).toBe(0);
    expect(state.lastRawLog).toBeUndefined();
    expect($.ui.log).toHaveBeenCalled();
  });

  it('avoids archives when the parser recognizes no removable noise', async () => {
    const input = answer('Unknown diagnostic context '.repeat(20) + '\n' + 'unrecognized\n'.repeat(80));
    const $ = host();
    expect(await processToolCall($, 'npm test', input, createSessionMetrics())).toBe(input);
    expect($.fs.write).not.toHaveBeenCalled();
  });

  it('does not replace a failed command with a fabricated success summary', async () => {
    const input = { result: { ...answer().result, exitCode: 1 } };
    expect(await processToolCall(host(), 'npm test', input, createSessionMetrics())).toBe(input);
  });

  it('preserves complete failure diagnostics on nonzero exit codes', async () => {
    const details = ' FAIL src/auth.test.ts\nAssertionError: expected 401, got 200\n  at src/auth.test.ts:12:3\n';
    const input = { result: { ...answer(raw + details).result, exitCode: 1 } };
    const output = await processToolCall(host(), 'npm test', input, createSessionMetrics());
    expect(stdout(output)).toContain(details);
  });

  it('accumulates concurrent runs without overwriting archives or metrics', async () => {
    const $ = host();
    const state = createSessionMetrics();
    await Promise.all(Array.from({ length: 5 }, () => processToolCall($, 'npm test', answer(), state)));
    expect(state.runsPruned).toBe(5);
    expect(new Set($.fs.write.mock.calls.map(([path]) => path)).size).toBe(5);
    expect(state.adapterBreakdown['Jest / Vitest']?.runs).toBe(5);
  });
});
