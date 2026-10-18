import { isSimpleCommand, plainLine, pruneStreams } from './shared.js';
import type { PruneResult, ToolAdapter } from './types.js';

const summary = /^test result: ok\. (\d+) passed; (\d+) failed; (\d+) ignored; (\d+) measured; (\d+) filtered out; finished in (\d+(?:\.\d+)?)s$/;
const passingTest = /^test .+ \.\.\. (?:ok|ignored)\s*$/;
const compiling = /^\s*(?:Compiling|Checking|Downloading|Downloaded)\s/;
const runner = /^\s*(?:Running\s|Doc-tests\s|running \d+ tests?\s*$)/;
const diagnostic = /^\s*(?:failures:|error(?:\[|:)|warning:|thread .+ panicked)/;

function condense(text: string): string {
  const raw = text.split('\n');
  const lines = raw.map(plainLine);
  const summaries = lines.map((line) => line.match(summary)).filter((match) => match !== null);
  if (summaries.length && summaries.every((match) => match[2] === '0') && lines.every((line) =>
    !line.trim() || passingTest.test(line) || runner.test(line) || summary.test(line))) {
    const totals = [0, 0, 0, 0, 0, 0];
    for (const match of summaries) {
      for (let i = 0; i < totals.length; i++) totals[i] = totals[i]! + Number(match[i + 1]);
    }
    return `✅ All Rust tests passed (${totals[0]} passed; ${totals[1]} failed; ${totals[2]} ignored; ${totals[3]} measured; ${totals[4]} filtered out in ${totals[5]!.toFixed(2)}s)`;
  }
  if (lines.some((line) => diagnostic.test(line))) {
    let inDiagnostic = false;
    return raw.filter((_, index) => {
      const line = lines[index]!;
      if (diagnostic.test(line)) inDiagnostic = true;
      return inDiagnostic || !(passingTest.test(line) || compiling.test(line) || runner.test(line));
    }).join('\n');
  }
  if (lines.some((line) => /^\s*Finished\s/.test(line)) && lines.every((line) => !line.trim() || compiling.test(line) || runner.test(line) || /^\s*Finished\s/.test(line))) {
    return raw.filter((_, index) => /^\s*Finished\s/.test(lines[index]!)).join('\n');
  }
  return text;
}

export class CargoTestAdapter implements ToolAdapter {
  readonly name = 'Cargo';

  canHandle(command: string, _stdout: string, _stderr?: string): boolean {
    return isSimpleCommand(command) && /^\s*cargo\s+(?:test|check|build)(?=\s|$)/.test(command);
  }

  prune(stdout: string, stderr?: string): PruneResult {
    return pruneStreams(this.name, stdout, stderr, condense);
  }
}
