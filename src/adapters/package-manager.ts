import { isSimpleCommand, plainLine, pruneStreams } from './shared.js';
import type { PruneResult, ToolAdapter } from './types.js';

function condense(text: string): string {
  const lines = text.split('\n');
  let inError = false;
  let removedNoise = false;
  const kept = lines.filter((raw) => {
    const line = plainLine(raw);
    if (/^(?:npm (?:ERR!(?=\s|$)|error\b)|ERROR[: ]|error[: ]|Traceback\b)|\b(?:ERESOLVE|Exception|\w*Error:)\b/.test(line)) inError = true;
    if (inError) return true;
    if (!line.trim()) return false;
    const noise = /^(?:npm (?:notice|warn deprecated)\b|\[[#= >\\/|\-]+\].*(?:reify|fetch)|reify:)/.test(line)
      || /^\s*(?:\d+ packages? are looking for funding|run `npm fund`)/.test(line)
      || /^(?:Progress: resolved |yarn (?:add|install) v|\[\d+\/\d+\] (?:Resolving|Fetching|Linking|Building) packages)/.test(line)
      || /^(?:Collecting |Downloading |\s*Downloading |Installing collected packages:|Requirement already satisfied:|Installing dependencies from lock file)/.test(line)
      || /^\s*- Installing \S+ \([^)]+\)\s*$/.test(line);
    removedNoise ||= noise;
    return !noise;
  }).join('\n');
  return removedNoise ? kept : text;
}

export class PackageManagerAdapter implements ToolAdapter {
  readonly name = 'Package managers';

  canHandle(command: string, _stdout: string, _stderr?: string): boolean {
    return isSimpleCommand(command) && /^\s*(?:(?:npm|pnpm)\s+(?:i|install|ci)|yarn\s+(?:add|install)|pip3?\s+install|poetry\s+(?:add|install))(?=\s|$)/.test(command);
  }

  prune(stdout: string, stderr?: string): PruneResult {
    return pruneStreams(this.name, stdout, stderr, condense);
  }
}
