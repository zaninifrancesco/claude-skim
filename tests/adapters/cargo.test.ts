import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CargoTestAdapter } from '../../src/adapters/cargo.js';

const fixture = (name: string) => readFileSync(new URL(`../../fixtures/${name}.log`, import.meta.url), 'utf8');
const adapter = new CargoTestAdapter();

describe('Cargo', () => {
  it.each(['cargo test', 'cargo test --workspace', 'cargo check', 'cargo build --release'])('matches %s', (command) => {
    expect(adapter.canHandle(command, '')).toBe(true);
  });
  it.each(['echo cargo test', 'cargo test-custom', 'cargo run', 'cargo test && cat secret', 'cargo test | tail'])('does not match %s', (command) => {
    expect(adapter.canHandle(command, '')).toBe(false);
  });
  it('summarizes all test targets and doctests in at most two lines', () => {
    const result = adapter.prune(fixture('cargo-passing'));
    expect(result.condensedStdout).toContain('5 passed');
    expect(result.condensedStdout).toContain('0 failed');
    expect(result.condensedStdout).toContain('0.05s');
    expect(result.condensedStdout.split('\n').length).toBeLessThanOrEqual(2);
    expect(result.tokensSaved).toBeGreaterThan(0);
  });
  it('preserves panic output and stack traces byte for byte', () => {
    const raw = fixture('cargo-failing');
    const result = adapter.prune(raw);
    expect(result.condensedStdout).toContain(raw.slice(raw.indexOf('failures:')));
    expect(result.condensedStdout).toContain('test tests::subtracts ... FAILED');
    expect(result.condensedStdout).not.toContain('test tests::adds ... ok');
  });
  it('preserves complete compilation diagnostics emitted on stderr', () => {
    const raw = fixture('cargo-compile-errors');
    const result = adapter.prune('', raw);
    expect(result.condensedStderr).toBe(raw.slice(raw.indexOf('error[E0308]')));
    expect(result.condensedStdout).toBe('');
  });
  it('removes compiling progress from successful builds', () => {
    const raw = fixture('cargo-build-passing');
    expect(adapter.prune(raw).condensedStdout).toBe(raw.slice(raw.indexOf('    Finished')).trimEnd());
  });
  it('keeps warnings and unknown runner messages', () => {
    const warning = 'warning: unused variable `value`\n --> src/lib.rs:7:9\n';
    const raw = fixture('cargo-passing');
    expect(adapter.prune(raw, warning).condensedStderr).toBe(warning);
    const custom = raw + 'custom runner: test execution was incomplete\n';
    expect(adapter.prune(custom).condensedStdout).toBe(custom);
  });
  it('retains ignored and filtered test counts', () => {
    const raw = 'running 2 tests\ntest tests::one ... ok\ntest tests::two ... ignored\ntest result: ok. 1 passed; 0 failed; 1 ignored; 0 measured; 4 filtered out; finished in 0.01s\n';
    const result = adapter.prune(raw);
    expect(result.condensedStdout).toContain('1 ignored');
    expect(result.condensedStdout).toContain('4 filtered out');
  });
  it('does not filter noise-shaped text inside panic details', () => {
    const raw = fixture('cargo-failing').replace('  left: 5', 'test expected::value ... ok\n   Compiling expected assertion text');
    expect(adapter.prune(raw).condensedStdout).toContain(raw.slice(raw.indexOf('failures:')));
  });
  it.each(['', 'Unrecognized cargo output\n', 'running 1 test\ntest tests::one ... ok\n'])('keeps incomplete or unknown output unchanged', (raw) => {
    expect(adapter.prune(raw).condensedStdout).toBe(raw);
  });
  it('matches token accounting across both streams', () => {
    const out = fixture('cargo-passing');
    const err = fixture('cargo-build-passing');
    const result = adapter.prune(out, err);
    expect(result.originalTokens).toBe(Math.ceil(out.length / 3.5) + Math.ceil(err.length / 3.5));
    expect(result.condensedTokens).toBe(Math.ceil(result.condensedStdout.length / 3.5) + Math.ceil((result.condensedStderr?.length ?? 0) / 3.5));
  });
});
