import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { JavaAdapter } from '../../src/adapters/java.js';

const fixture = (name: string) => readFileSync(new URL(`../../fixtures/${name}.log`, import.meta.url), 'utf8');
const adapter = new JavaAdapter();

describe('Java (Maven / Gradle / JUnit)', () => {
  it.each(['mvn test', 'mvn clean test', 'mvn clean', 'mvn verify -DskipTests', './mvnw test', './mvnw clean verify', 'gradle test --info', './gradlew test', 'gradle check', './gradlew check', './gradlew :app:test'])('matches %s', (command) => {
    expect(adapter.canHandle(command, '')).toBe(true);
  });
  it.each(['echo mvn test', 'mvn tester', 'mvn deploy', 'gradle build', './gradlew testCustom', 'mvn test && cat secret', 'gradle test | tail', 'mvn test > out.log'])('does not match %s', (command) => {
    expect(adapter.canHandle(command, '')).toBe(false);
  });

  it('summarizes Maven without counting suite totals twice', () => {
    const result = adapter.prune(fixture('mvn-test-passing'));
    expect(result.condensedStdout).toBe('✅ All Java tests passed (16 tests across 3 suites in 3.214s)');
    expect(result.tokensSaved).toBeGreaterThan(result.originalTokens * 0.9);
  });
  it('sums aggregate totals across Maven modules', () => {
    const raw = fixture('mvn-test-passing');
    expect(adapter.prune(raw + raw).condensedStdout).toContain('32 tests across 6 suites');
  });
  it('keeps skipped counts and does not claim tests ran on clean-only or empty runs', () => {
    const raw = fixture('mvn-test-passing').replaceAll('Skipped: 0', 'Skipped: 1');
    expect(adapter.prune(raw).condensedStdout).toContain('1 skipped');
    const clean = '[INFO] Scanning for projects...\n[INFO] BUILD SUCCESS\n[INFO] Total time: 1.2 s\n';
    expect(adapter.prune(clean).condensedStdout).toBe('✅ Java build successful (1.2s)');
    const empty = clean.replace('[INFO] BUILD SUCCESS', '[INFO] Tests run: 0, Failures: 0, Errors: 0, Skipped: 0\n[INFO] BUILD SUCCESS');
    expect(adapter.prune(empty).condensedStdout).not.toContain('All Java tests passed');
  });
  it('summarizes Gradle without inventing counts', () => {
    expect(adapter.prune(fixture('gradle-test-passing')).condensedStdout).toBe('✅ All Java tests passed (4s)');
  });
  it('does not claim cached, skipped or absent Gradle tests executed', () => {
    const raw = fixture('gradle-test-passing');
    for (const status of ['UP-TO-DATE', 'NO-SOURCE', 'SKIPPED', 'FROM-CACHE']) {
      expect(adapter.prune(raw.replace('> Task :test\n', `> Task :test ${status}\n`)).condensedStdout).toBe('✅ Java build successful (4s)');
    }
    expect(adapter.prune('BUILD SUCCESSFUL in 4s\n').condensedStdout).not.toContain('All Java tests passed');
  });
  it('preserves complete Maven failures and removes passing suites on either side', () => {
    const raw = fixture('mvn-test-failing');
    const out = adapter.prune(raw).condensedStdout;
    const start = raw.indexOf('[ERROR] Tests run: 3');
    const end = raw.indexOf('[INFO] Running com.example.util.');
    expect(out).toContain(raw.slice(start, end));
    expect(out).toContain('[ERROR] Failures: \n[ERROR]   AuthTokenTest.shouldRejectExpiredToken:42 expected: <401> but was: <200>');
    expect(out).toContain('[ERROR] Tests run: 16, Failures: 1, Errors: 0, Skipped: 0');
    expect(out).not.toContain('UserServiceTest');
    expect(out).not.toContain('DateUtilsTest');
    expect(out).not.toContain('maven-resources-plugin');
  });
  it('preserves Errors blocks and Maven compilation diagnostics byte for byte', () => {
    const raw = fixture('mvn-compile-errors');
    expect(adapter.prune(raw).condensedStdout).toBe(raw.slice(raw.indexOf('[ERROR]')));
    const errors = fixture('mvn-test-failing').replace('[ERROR] Failures:', '[ERROR] Errors:');
    expect(adapter.prune(errors).condensedStdout).toContain('[ERROR] Errors:');
  });
  it('preserves Gradle assertions, cause chains, suppressed exceptions and report paths', () => {
    const raw = fixture('gradle-test-failing');
    expect(adapter.prune(raw).condensedStdout).toBe(raw.slice(raw.indexOf('com.example.AuthTest')));
  });
  it('keeps noise-shaped assertion text inside a failure block', () => {
    const raw = fixture('mvn-test-failing').replace('org.opentest4j.AssertionFailedError:', '[INFO] --- expected assertion text ---\nDownloading from central: expected assertion text\norg.opentest4j.AssertionFailedError:');
    const block = raw.slice(raw.indexOf('[ERROR] Tests run: 3'), raw.indexOf('[INFO] Running com.example.util.'));
    expect(adapter.prune(raw).condensedStdout).toContain(block);
  });
  it('handles ANSI and CRLF while retaining original failure bytes', () => {
    const raw = fixture('mvn-test-failing').replaceAll('[ERROR]', '\u001b[31m[ERROR]\u001b[0m').replaceAll('\n', '\r\n');
    expect(adapter.prune(raw).condensedStdout).toContain(raw.slice(raw.indexOf('\u001b[31m[ERROR]'), raw.indexOf('[INFO] Running com.example.util.')));
    expect(adapter.prune(fixture('mvn-test-passing').replaceAll('\n', '\r\n')).condensedStdout).toContain('16 tests across 3 suites');
  });
  it.each(['', '[INFO] Running com.example.Test\n', '> Task :test\n', 'unknown output\n'])('passes unknown or incomplete output through: %s', (raw) => {
    expect(adapter.prune(raw).condensedStdout).toBe(raw);
  });
  it('keeps warnings and custom output even alongside success markers', () => {
    const raw = fixture('mvn-test-passing');
    for (const extra of ['[WARNING] Test execution was skipped\n', '[INFO] Custom diagnostic: expected 401\n', 'java.lang.IllegalStateException: background thread failed\n']) {
      expect(adapter.prune(raw + extra).condensedStdout).toContain(extra);
      expect(adapter.prune(raw + extra).condensedStdout).not.toContain('✅');
    }
  });
  it('keeps stderr separate and avoids success summaries when the other stream fails', () => {
    const err = fixture('mvn-compile-errors');
    const result = adapter.prune(fixture('mvn-test-passing'), err);
    expect(result.condensedStderr).toContain(err.slice(err.indexOf('[ERROR]')));
    expect(result.condensedStdout).not.toContain('✅');
    const stderrOnly = adapter.prune('', fixture('gradle-test-failing'));
    expect(stderrOnly.condensedStdout).toBe('');
    expect(stderrOnly.condensedStderr).toContain('Suppressed:');
  });
  it('accounts for both streams using the existing token heuristic', () => {
    const out = fixture('mvn-test-failing');
    const err = fixture('gradle-test-failing');
    const result = adapter.prune(out, err);
    expect(result.originalTokens).toBe(Math.ceil(out.length / 3.5) + Math.ceil(err.length / 3.5));
    expect(result.condensedTokens).toBe(Math.ceil(result.condensedStdout.length / 3.5) + Math.ceil(result.condensedStderr!.length / 3.5));
    expect(result.tokensSaved).toBe(result.originalTokens - result.condensedTokens);
    expect(result.matchedAdapter).toBe('Java (Maven / Gradle)');
  });
});
