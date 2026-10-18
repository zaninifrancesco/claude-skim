import { isSimpleCommand, plainLine, pruneStreams } from './shared.js';
import type { PruneResult, ToolAdapter } from './types.js';

const passingSuite = /^\s*PASS\s+\S+\.(?:spec|test)\.[cm]?[jt]sx?\s*$/;
const passingRow = /^\s*[✓✔]\s/;
const failureHeader = /^\s*(?:FAIL\s|●\s)/;
const summaryRow = /^\s*(?:Test Suites:|Test Files\s|Tests[:\s]|Snapshots:|Time:|Start at\s|Duration\s)/;

function condense(text: string): string {
  const raw = text.split('\n');
  const lines = raw.map(plainLine);
  if (lines.some((line) => failureHeader.test(line))) {
    let inDiagnostic = false;
    return raw.filter((_, i) => {
      const line = lines[i]!;
      if (passingSuite.test(line)) {
        inDiagnostic = false;
        return false;
      }
      if (failureHeader.test(line)) inDiagnostic = true;
      return inDiagnostic || !passingRow.test(line);
    }).join('\n');
  }

  const tests = lines.find((line) => /^\s*Tests[:\s]/.test(line));
  const passed = tests?.match(/\b(\d+) passed\b/)?.[1];
  if (!passed || lines.some((line) => /\b(?:FAIL|FAILED|Error|\w*Error|Exception)\b|\b[1-9]\d* failed\b/.test(line))) return text;
  const knownNoise = (line: string) => !line.trim() || passingSuite.test(line) || passingRow.test(line)
    || summaryRow.test(line) || /^\s*(?:>\s|RUN\s|Ran all test suites\.)/.test(line);
  if (!lines.every(knownNoise)) return text;

  const suites = lines.find((line) => /^\s*(?:Test Suites:|Test Files\s)/.test(line))?.match(/\b(\d+) passed\b/)?.[1];
  const time = lines.find((line) => /^\s*(?:Time:|Duration\s)/.test(line))?.match(/(\d+(?:\.\d+)?)\s*(ms|s)\b/);
  const snapshots = lines.find((line) => /^\s*Snapshots:/.test(line));
  const counts = tests!.replace(/^\s*Tests:?\s+/, '').trim();
  return `✅ Tests passed (${counts}${suites ? ` across ${suites} suites` : ''}${time ? ` in ${time[1]}${time[2]}` : ''})${snapshots ? `; ${snapshots.trim()}` : ''}`;
}

export class JestVitestAdapter implements ToolAdapter {
  readonly name = 'Jest / Vitest';

  canHandle(command: string, _stdout: string, _stderr?: string): boolean {
    return isSimpleCommand(command) && /^\s*(?:(?:npx\s+)?(?:jest|vitest)(?=\s|$)|(?:npm|pnpm|yarn)\s+(?:test(?=\s|$)|run\s+test[\w:-]*(?=\s|$)))/.test(command);
  }

  prune(stdout: string, stderr?: string): PruneResult {
    return pruneStreams(this.name, stdout, stderr, condense);
  }
}
