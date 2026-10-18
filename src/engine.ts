import type { EngineInterface, ToolCallResult } from 'claude-code';
import { archiveRawOutput } from './archiver.js';
import type { SessionMetrics } from './metrics.js';
import { routeCommand } from './router.js';
import { estimateTokens } from './utils/tokens.js';

export const MIN_LINES_THRESHOLD = 30;
type EngineHost = { fs: Pick<EngineInterface['fs'], 'write'>; ui: Pick<EngineInterface['ui'], 'log'> };
const lineCount = (text: string) => text ? text.split('\n').length : 0;

function logFailure($: EngineHost): void {
  try { $.ui.log('Skim: pruning failed; returning the original tool output.'); } catch { /* A closed UI must not block Bash. */ }
}

export async function processToolCall(
  $: EngineHost,
  command: string,
  answer: ToolCallResult<'Bash'>,
  state: SessionMetrics,
): Promise<ToolCallResult<'Bash'>> {
  state.runsPassedThrough++;
  try {
    if (!state.enabled || answer.deny !== undefined || answer.isError) return answer;
    const record = answer.result;
    if (!record || typeof record.stdout !== 'string' || typeof record.stderr !== 'string') return answer;
    if (record.interrupted || record.isImage || record.backgroundTaskId || record.persistedOutputPath || record.rawOutputPath || record.structuredContent?.length) return answer;
    const { stdout, stderr } = record;
    const raw = stdout + stderr;
    if (/permission denied|operation not permitted|command not found/i.test(raw)) return answer;
    if (raw.length < 1500 || lineCount(raw) < MIN_LINES_THRESHOLD) return answer;
    if (/[\x00-\x08\x0b\x0c\x0e-\x1a\x1c-\x1f]/.test(raw) || /^[A-Za-z\d+/\s]+={0,2}\s*$/.test(raw) && raw.replace(/\s/g, '').length > 200) return answer;
    const adapter = routeCommand(command, stdout, stderr);
    if (!adapter) return answer;
    const pruned = adapter.prune(stdout, stderr);
    if (pruned.tokensSaved <= 0) return answer;
    if ('exitCode' in record && record.exitCode !== 0 && record.exitCode !== undefined && /✅/.test(pruned.condensedStdout + (pruned.condensedStderr ?? ''))) return answer;
    const path = await archiveRawOutput($.fs, stdout, stderr);
    if (!path) {
      logFailure($);
      return answer;
    }
    const outLines = lineCount(pruned.condensedStdout) + lineCount(pruned.condensedStderr ?? '') + 1;
    const footer = `[skim: condensed ${lineCount(raw)} lines -> ${outLines} lines. Full raw log: ${path}]`;
    const condensedStdout = `${pruned.condensedStdout}\n${footer}`;
    const condensedStderr = pruned.condensedStderr ?? stderr;
    const before = estimateTokens(stdout) + estimateTokens(stderr);
    const after = estimateTokens(condensedStdout) + estimateTokens(condensedStderr);
    if (after >= before) return answer;

    state.tokensBeforePruning += before;
    state.tokensAfterPruning += after;
    state.tokensSaved += before - after;
    state.runsPruned++;
    state.runsPassedThrough--;
    state.lastRawLog = path;
    state.lastPrunedTimestamp = Date.now();
    const breakdown = state.adapterBreakdown[adapter.name] ??= { runs: 0, tokensSaved: 0 };
    breakdown.runs++;
    breakdown.tokensSaved += before - after;
    // Drop core's cached rendering so the host maps the changed result again.
    const { ref: _ref, text: _text, ...rest } = answer;
    return { ...rest, result: { ...record, stdout: condensedStdout, stderr: condensedStderr } };
  } catch {
    logFailure($);
    return answer;
  }
}
