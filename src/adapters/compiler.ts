import { isSimpleCommand, plainLine, pruneStreams } from './shared.js';
import type { PruneResult, ToolAdapter } from './types.js';

function isNoise(line: string): boolean {
  return !line.trim() || /^>\s/.test(line)
    || /^(?:\[[\d: ]+\]\s*)?(?:Starting compilation|File change detected|Found 0 errors\.)/.test(line)
    || /^All checks passed!$/.test(line);
}

function condense(text: string): string {
  const raw = text.split('\n');
  const lines = raw.map(plainLine);
  const start = lines.findIndex((line) => line.trim() && !isNoise(line));
  if (start !== -1) {
    if (lines.some((line) => /Found 0 errors\.|^All checks passed!$/.test(line))) return text;
    return raw.slice(start).join('\n');
  }
  if (lines.some((line) => /Found 0 errors\.|^All checks passed!$/.test(line))) return '✅ No lint/type errors found';
  return text;
}

export class CompilerLinterAdapter implements ToolAdapter {
  readonly name = 'Compilers / linters';

  canHandle(command: string, _stdout: string, _stderr?: string): boolean {
    return isSimpleCommand(command) && /^\s*(?:(?:npx\s+)?(?:tsc|eslint)|ruff\s+check|flake8)(?=\s|$)/.test(command);
  }

  prune(stdout: string, stderr?: string): PruneResult {
    return pruneStreams(this.name, stdout, stderr, condense);
  }
}
