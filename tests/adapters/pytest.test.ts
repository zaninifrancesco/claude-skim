import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PytestAdapter } from '../../src/adapters/pytest.js';

const fixture = (name: string) => readFileSync(new URL(`../../fixtures/${name}.log`, import.meta.url), 'utf8');
const adapter = new PytestAdapter();

describe('Pytest / unittest', () => {
  it.each(['pytest -q', 'python -m pytest', 'python3 -m unittest', 'python -m unittest discover', 'poetry run pytest'])('matches %s', (command) => {
    expect(adapter.canHandle(command, '')).toBe(true);
  });

  it.each(['echo pytest', 'pytest-unknown', 'python -m pytest.other', 'cat pytest.log', 'python script.py', 'pytest && cat secret', 'pytest | tail', 'pytest\ncat secret'])('does not match %s', (command) => {
    expect(adapter.canHandle(command, '')).toBe(false);
  });

  it.each(['pytest-passing', 'unittest-passing'])('condenses %s to at most two lines', (name) => {
    const result = adapter.prune(fixture(name));
    expect(result.condensedStdout.split('\n').length).toBeLessThanOrEqual(2);
    expect(result.condensedStdout).toContain('passed');
    expect(result.condensedStdout).toContain(name === 'pytest-passing' ? '28' : '3');
  });

  it('preserves the full pytest failure block and final summary', () => {
    const raw = fixture('pytest-failing');
    const result = adapter.prune(raw);
    expect(result.condensedStdout).toContain(raw.slice(raw.indexOf('=================================== FAILURES')));
    expect(result.condensedStdout).not.toContain('tests/test_api.py ....');
    expect(result.condensedStdout).toContain('tests/test_database.py:48: TimeoutError');
  });

  it('preserves unittest tracebacks and strips only passing rows', () => {
    const raw = fixture('unittest-failing');
    const result = adapter.prune(raw);
    expect(result.condensedStdout).toContain(raw.slice(raw.indexOf('FAIL:')));
    expect(result.condensedStdout).not.toContain('test_add');
    expect(result.condensedStdout).toContain('test_status');
  });

  it('keeps collection errors and warnings verbatim', () => {
    const block = '================ ERRORS ================\nERROR collecting tests/test_api.py\nImportError: missing module\n  File "tests/test_api.py", line 1\n================ warnings summary ================\nDeprecationWarning: old API\n================ 1 error in 0.01s ================\n';
    const raw = fixture('pytest-passing').split('============================== 28 passed')[0] + block;
    expect(adapter.prune(raw).condensedStdout).toContain(block);
  });

  it('keeps test-like text inside tracebacks', () => {
    const raw = fixture('pytest-failing').replace('db = <DatabaseClient state=DISCONNECTED>', 'tests/expected.py .... [100%]\n...\nplatform diagnostic from assertion');
    expect(adapter.prune(raw).condensedStdout).toContain(raw.slice(raw.indexOf('=================================== FAILURES')));
  });

  it('keeps stderr errors and estimates both streams', () => {
    const raw = fixture('pytest-passing');
    const stderr = 'Traceback (most recent call last):\nRuntimeError: teardown failed\n';
    const result = adapter.prune(raw, stderr);
    expect(result.condensedStderr).toBe(stderr);
    expect(result.originalTokens).toBe(Math.ceil(raw.length / 3.5) + Math.ceil(stderr.length / 3.5));
    expect(result.tokensSaved).toBeGreaterThan(0);
  });

  it.each(['', '..F..\n', 'Unknown output\n', '28 passed in 1.0s\nWarning: unclosed socket\n'])('passes through unrecognized output', (raw) => {
    expect(adapter.prune(raw).condensedStdout).toBe(raw);
  });
});

it('keeps a single unittest test count', () => {
  const raw = 'test_one (tests.One.test_one) ... ok\n\n----------------------------------------------------------------------\nRan 1 test in 0.002s\n\nOK\n';
  expect(adapter.prune(raw).condensedStdout).toContain('1 passed');
});
