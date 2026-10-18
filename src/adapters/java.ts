import { isSimpleCommand, plainLine, pruneStreams } from './shared.js';
import type { PruneResult, ToolAdapter } from './types.js';

const mavenSummary = /^\[INFO\]\s+Tests run: (\d+), Failures: (\d+), Errors: (\d+), Skipped: (\d+)(?:, Time elapsed: (\d+(?:\.\d+)?) s)?(?: --? in (.+))?\s*$/;
const mavenNoise = /^\[INFO\](?:\s*$|\s+(?:Scanning for projects\.\.\.|Building .+|from pom\.xml|[-]+.*|Copying .+|Nothing to compile .+|Changes detected .+|Compiling .+|Using auto detected provider: .+|Running [\w.$]+|T E S T S|Results:|BUILD SUCCESS|Total time:\s+.+|Finished at: .+))$/;
const download = /^(?:\[INFO\]\s+)?(?:Downloading from |Downloaded from |Progress \().*/;
const gradleTask = /^> Task :[\w:.-]+(?: (?:UP-TO-DATE|NO-SOURCE|SKIPPED|FROM-CACHE))?$/;
const gradleSuccess = /^BUILD SUCCESSFUL in (.+)$/;
const gradleSummary = /^(\d+) tests? completed(?:, (\d+) failed)?(?:, (\d+) skipped)?$/;
const diagnostic = /(?:^\[ERROR\]|^\[WARNING\]|^WARNING:|\b[\w.$]*(?:Exception|Error)(?::|$)|\berror:|\bFAILED\b|^FAILURE:|BUILD FAILURE|<<< FAILURE!)/;

function isDiagnostic(line: string): boolean {
  const maven = line.match(mavenSummary);
  const gradle = line.match(gradleSummary);
  return diagnostic.test(line) || !!(maven && (Number(maven[2]) || Number(maven[3])))
    || !!(gradle && Number(gradle[2]));
}

function noise(line: string): boolean {
  return !line.trim() || mavenNoise.test(line) || download.test(line) || gradleTask.test(line)
    || /^Starting a Gradle Daemon\b/.test(line)
    || /^\d+ actionable tasks?: .+$/.test(line);
}

function condense(text: string, allowSuccess: boolean): string {
  const raw = text.split('\n');
  const lines = raw.map(plainLine);
  const hasDiagnostic = lines.some(isDiagnostic);
  if (allowSuccess && !hasDiagnostic) {
    const summaries = lines.map((line) => line.match(mavenSummary)).filter((match) => match !== null);
    if (lines.includes('[INFO] BUILD SUCCESS') && lines.every((line) => noise(line) || mavenSummary.test(line))
      && summaries.every((match) => match[2] === '0' && match[3] === '0')) {
      // Aggregate summaries already include the per-suite counts.
      const aggregates = summaries.filter((match) => !match[6]);
      const totals = aggregates.length ? aggregates : summaries;
      const count = totals.reduce((sum, match) => sum + Number(match[1]), 0);
      const skipped = totals.reduce((sum, match) => sum + Number(match[4]), 0);
      const suites = summaries.filter((match) => match[6]).length;
      const timed = summaries.filter((match) => match[5] && match[6]);
      const elapsed = lines.map((line) => line.match(/^\[INFO\] Total time:\s+(.+)$/)).filter((match) => match !== null).at(-1)?.[1]?.replace(/\s+s$/, 's')
        ?? (timed.length ? `${Number(timed.reduce((sum, match) => sum + Number(match[5]), 0).toFixed(3))}s` : undefined);
      const details = `${count} tests${suites ? ` across ${suites} suite${suites === 1 ? '' : 's'}` : ''}${skipped ? `, ${skipped} skipped` : ''}${elapsed ? ` in ${elapsed}` : ''}`;
      return count > skipped ? `✅ All Java tests passed (${details})`
        : `✅ Java build successful (${summaries.length ? details : elapsed ?? 'no test results'})`;
    }
    const success = lines.map((line) => line.match(gradleSuccess)).find((match) => match !== null);
    const gradleTotals = lines.map((line) => line.match(gradleSummary)).filter((match) => match !== null);
    if (success && lines.every((line) => noise(line) || gradleSuccess.test(line) || gradleSummary.test(line))
      && gradleTotals.every((match) => !match[2] || match[2] === '0')) {
      const executedTests = lines.some((line) => /^> Task :(?:[\w.-]+:)*test$/.test(line))
        && (!gradleTotals.length || gradleTotals.some((match) => Number(match[1]) > Number(match[3] ?? 0)));
      const counts = gradleTotals.map((match) => `${match[1]} tests${match[3] ? `, ${match[3]} skipped` : ''}`).join('; ');
      return `✅ ${executedTests ? 'All Java tests passed' : 'Java build successful'} (${counts ? `${counts} in ` : ''}${success[1]})`;
    }
  }
  if (!hasDiagnostic) return text;

  let inDiagnostic = false;
  const kept: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const nextSummary = lines[i + 1]?.match(mavenSummary);
    // A complete passing-suite pair marks a return to Maven's runner output.
    if (/^\[INFO\] Running [\w.$]+$/.test(line) && nextSummary?.[6]
      && nextSummary[2] === '0' && nextSummary[3] === '0') {
      inDiagnostic = false;
      i++;
      continue;
    }
    if (isDiagnostic(line)) inDiagnostic = true;
    if (inDiagnostic || !(noise(line) || mavenSummary.test(line))) kept.push(raw[i]!);
  }
  return kept.join('\n');
}

export class JavaAdapter implements ToolAdapter {
  readonly name = 'Java (Maven / Gradle)';

  canHandle(command: string, _stdout: string, _stderr?: string): boolean {
    return isSimpleCommand(command) && /^\s*(?:(?:mvn|\.\/mvnw)\s+(?:test|clean|verify)|(?:gradle|\.\/gradlew)\s+(?::?[\w.-]+:)*(?:test|check))(?=\s|$)/.test(command);
  }

  prune(stdout: string, stderr?: string): PruneResult {
    const allowSuccess = ![stdout, stderr ?? ''].some((stream) => stream.split('\n').some((line) => isDiagnostic(plainLine(line))));
    return pruneStreams(this.name, stdout, stderr, (text) => condense(text, allowSuccess));
  }
}
