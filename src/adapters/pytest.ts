import { isSimpleCommand, plainLine, pruneStreams } from './shared.js';
import type { PruneResult, ToolAdapter } from './types.js';

const pytestSummary = /^=+\s+(.+\bpassed\b.*\bin\s+\d+(?:\.\d+)?s)\s+=+$/;
const diagnosticStart = /^(?:=+\s+(?:FAILURES|ERRORS)\s+=+|(?:FAIL|ERROR):\s)/;
const unittestPass = /^\S.*\s\.\.\. ok$/;

function isNoise(line: string): boolean {
  return !line.trim() || /^[.s]+$/.test(line) || unittestPass.test(line)
    || /^=+ test session starts =+$/.test(line)
    || /^(?:platform\s|rootdir:|plugins:|cachedir:|configfile:|collected \d+ items?)/.test(line)
    || /^\S+\.py(?:::\S+)?\s+[.FsExX]+\s*(?:\[\s*\d+%\])?$/.test(line)
    || /^-{5,}$/.test(line);
}

function condense(text: string): string {
  const raw = text.split('\n');
  const lines = raw.map(plainLine);
  const start = lines.findIndex((line) => diagnosticStart.test(line));
  if (start !== -1) {
    return raw.filter((_, i) => i >= start || !isNoise(lines[i]!)).join('\n');
  }

  const summary = lines.find((line) => pytestSummary.test(line));
  if (summary && lines.every((line) => isNoise(line) || pytestSummary.test(line))) {
    if (/\b(?:failed|error|errors|warnings?)\b/.test(summary)) return text;
    return `✅ All tests passed (${summary.match(pytestSummary)![1]})`;
  }

  const ran = lines.find((line) => /^Ran \d+ tests? in \d+(?:\.\d+)?s$/.test(line));
  if (ran && lines.includes('OK') && lines.every((line) => isNoise(line) || line === ran || line === 'OK')) {
    return `✅ All tests passed (${ran.replace(/^Ran /, '').replace(/ tests?\b/, ' passed')})`;
  }
  return text;
}

export class PytestAdapter implements ToolAdapter {
  readonly name = 'Pytest / unittest';

  canHandle(command: string, _stdout: string, _stderr?: string): boolean {
    return isSimpleCommand(command) && /^\s*(?:poetry\s+run\s+)?(?:pytest(?=\s|$)|python(?:3(?:\.\d+)?)?\s+-m\s+(?:pytest|unittest)(?=\s|$))/.test(command);
  }

  prune(stdout: string, stderr?: string): PruneResult {
    return pruneStreams(this.name, stdout, stderr, condense);
  }
}
