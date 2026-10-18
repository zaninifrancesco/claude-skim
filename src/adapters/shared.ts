import { estimateTokens } from '../utils/tokens.js';
import type { PruneResult } from './types.js';

export function plainLine(line: string): string {
  return line.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '').replace(/\r$/, '');
}

export function isSimpleCommand(command: string): boolean {
  // Shell composition can mix unrelated output; leave it to the host untouched.
  return !/[;&|<>`$\n\r]/.test(command);
}

export function pruneStreams(
  name: string,
  stdout: string,
  stderr: string | undefined,
  condense: (text: string) => string,
): PruneResult {
  let condensedStdout = stdout;
  let condensedStderr = stderr;
  try {
    const out = condense(stdout);
    const err = stderr === undefined ? undefined : condense(stderr);
    if (out.length < stdout.length) condensedStdout = out;
    if (err !== undefined && err.length < (stderr?.length ?? 0)) condensedStderr = err;
  } catch {
    // A parser failure must preserve both original streams.
    condensedStdout = stdout;
    condensedStderr = stderr;
  }
  const originalTokens = estimateTokens(stdout) + estimateTokens(stderr ?? '');
  const condensedTokens = estimateTokens(condensedStdout) + estimateTokens(condensedStderr ?? '');
  const lines = (text: string | undefined) => text ? text.split('\n').length : 0;
  return {
    condensedStdout,
    condensedStderr,
    originalTokens,
    condensedTokens,
    tokensSaved: originalTokens - condensedTokens,
    linesRemoved: lines(stdout) + lines(stderr) - lines(condensedStdout) - lines(condensedStderr),
    matchedAdapter: name,
  };
}
