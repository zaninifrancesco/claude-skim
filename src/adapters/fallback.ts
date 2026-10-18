import { plainLine, pruneStreams } from './shared.js';
import type { PruneResult, ToolAdapter } from './types.js';

function condense(text: string): string {
  const lines = text.split('\n');
  if (lines.length <= 35 || /\b(?:\w*error|fail(?:ed|ure)?|\w*exception|panic(?:ked)?|warning)\b|^\s+at\s/im.test(plainLine(text))) return text;
  return [...lines.slice(0, 10), `... [skim: ${lines.length - 35} lines omitted] ...`, ...lines.slice(-25)].join('\n');
}

export class GenericFallbackAdapter implements ToolAdapter {
  readonly name = 'Fallback';

  canHandle(_command: string, stdout: string, stderr?: string): boolean {
    return stdout.split('\n').length > 35 || (stderr?.split('\n').length ?? 0) > 35;
  }

  prune(stdout: string, stderr?: string): PruneResult {
    return pruneStreams(this.name, stdout, stderr, condense);
  }
}
