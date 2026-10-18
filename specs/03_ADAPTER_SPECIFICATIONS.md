# 03 - Adapter Specifications & Parsing Rules

> Safety precedence: retain every stack frame, including `node_modules` frames.
> The fallback is standalone and retains output containing diagnostics; the
> router passes unknown commands through unchanged (`AGENTS.md`).

## 1. Overview & General Adapter Interface

Every tool adapter must implement the `ToolAdapter` interface:

```typescript
export interface PruneResult {
  condensedStdout: string;
  condensedStderr?: string;
  originalTokens: number;
  condensedTokens: number;
  tokensSaved: number;
  linesRemoved: number;
  matchedAdapter: string;
}

export interface ToolAdapter {
  readonly name: string;
  canHandle(command: string, stdout: string, stderr?: string): boolean;
  prune(stdout: string, stderr?: string): PruneResult;
}
```

---

## 2. Specialized Adapters

### 2.1 `JestVitestAdapter`
- **Matches**: `jest`, `vitest`, `npm test`, `pnpm test`, `yarn test`, `npx vitest`, `npm run test*`.
- **Parsing Logic**:
  1. **All Tests Passed**:
     - Strips: all passing test rows (`✓ test/name.spec.ts`), console logs, execution timings.
     - Preserves: test summary block (`Test Suites: X passed, X total`, `Tests: Y passed, Y total`, `Snapshots: ...`, `Time: ...`).
     - Condensed Output:
       ```text
       ✅ All tests passed (142 tests across 12 suites in 3.4s)
       ```
  2. **Tests Failed**:
     - Strips: all passing test lines (`✓ test/pass.spec.ts`), redundant separator lines (`----`, `====`).
     - Preserves:
       - Header line: `FAIL src/auth/login.spec.ts`
       - Test name: `● Auth > should reject expired JWT`
       - Assertion diff: `Expected: 401, Received: 200`
       - Code snippet & line pointer: `> 42 | expect(res.status).toBe(401);`
       - User stack frame: `at Object.<anonymous> (src/auth/login.spec.ts:42:15)`
       - Final summary: `Test Suites: 1 failed, 11 passed, 12 total`

---

### 2.2 `PytestAdapter`
- **Matches**: `pytest`, `python -m pytest`, `python -m unittest`, `poetry run pytest`.
- **Parsing Logic**:
  1. **All Tests Passed**:
     - Strips: the dot progress bar (`.....`, `100% [.....]`), root dir info, plugins list.
     - Condensed Output:
       ```text
       ✅ All tests passed (89 passed in 1.42s)
       ```
  2. **Tests Failed**:
     - Strips: the dot progress matrix (`..F....s..`), passing test summaries, deprecation warning lists.
     - Preserves:
       - `=== FAILURES ===` block in full.
       - The failure header: `___ test_calculate_discount ___`
       - The traceback and code lines.
       - The final error line: `E       AssertionError: assert 90 == 80`
       - Summary line: `=== 1 failed, 88 passed, 2 warnings in 2.10s ===`

---

### 2.3 `CargoTestAdapter`
- **Matches**: `cargo test`, `cargo check`, `cargo build`.
- **Parsing Logic**:
  1. **All Tests Passed**:
     - Strips: compiling dependency list (`Compiling libc v0.2...`), running test listings (`test tests::foo ... ok`).
     - Condensed Output:
       ```text
       ✅ All Rust tests passed (45 passed; 0 failed; 0 ignored in 0.85s)
       ```
  2. **Tests Failed / Compile Error**:
     - Strips: `Compiling ...` lines, all `test ... ok` lines.
     - Preserves:
       - `failures:` block with failing test names.
       - Panic backtrace: `thread 'main' panicked at 'assertion failed: ...'`
       - Compiler error diagnostics: `error[E0308]: mismatched types` with ASCII pointers `^^^`.

---

### 2.4 `GoTestAdapter`
- **Matches**: `go test`, `go test ./...`.
- **Parsing Logic**:
  1. **All Tests Passed**:
     - Strips: `=== RUN TestFoo`, `--- PASS: TestFoo (0.00s)`.
     - Preserves package summaries: `ok  github.com/org/pkg  0.412s`.
  2. **Tests Failed**:
     - Strips: all `=== RUN` and `--- PASS` lines.
     - Preserves: `--- FAIL: TestBar (0.01s)`, file/line logs (`bar_test.go:34: unexpected result`), and package failure exit.

---

### 2.5 `JavaAdapter` (Maven, Gradle, JUnit)
- **Matches**: `mvn test*`, `mvn clean*`, `./mvnw test*`, `mvn verify*`, `gradle test*`, `./gradlew test*`, `gradle check*`, `./gradlew check*`.
- **Noise Characteristics**:
  - Extremely verbose: `[INFO] Scanning for projects...`, `[INFO] --- maven-resources-plugin...`, `Downloading from central...`, `> Task :compileJava`, `> Task :processResources`.
- **Parsing Logic**:
  1. **All Tests Passed**:
     - Strips: all `[INFO] --- plugin...`, dependency downloads, `[INFO] Running com.example.*` lines.
     - Preserves: test count & execution time from `[INFO] Tests run: X, Failures: 0, Errors: 0, Skipped: 0` or Gradle `BUILD SUCCESSFUL`.
     - Condensed Output:
       ```text
       ✅ All Java tests passed (142 tests across 8 suites in 4.2s)
       ```
  2. **Tests Failed / Build Error**:
     - Strips: all plugin execution boilerplate, passing test suites, repetitive reactor summary banners.
     - Preserves:
       - Maven Surefire `[ERROR] Failures:` and `[ERROR] Errors:` blocks.
       - Gradle `> Task :test FAILED` and failing test methods (`com.example.AuthTest > testExpiredToken() FAILED`).
       - Full assertion error messages (`org.opentest4j.AssertionFailedError: expected: <401> but was: <200>`).
       - Full stack trace frames.
       - Summary line: `[ERROR] Tests run: 142, Failures: 1, Errors: 0, Skipped: 0`.

---

### 2.6 `PackageManagerAdapter` (npm, pnpm, yarn, pip)
- **Matches**: `npm i*`, `pnpm i*`, `yarn add*`, `pip install*`, `poetry add*`.
- **Noise Characteristics**:
  - `npm notice`, download progress bars `[=======>    ]`, `reify:rxjs: timing`, `npm warn deprecated`, pip wheel download bars.
- **Parsing Logic**:
  - Retain ONLY:
    - Added package count: `added 14 packages, and audited 182 packages in 2s`
    - Security audit summary: `found 0 vulnerabilities`
    - Any fatal errors: `ERESOLVE unable to resolve dependency tree` or `pip ERROR: Could not find a version...`
  - All intermediary download and progress lines are discarded.

---

### 2.7 `CompilerLinterAdapter` (tsc, eslint, ruff)
- **Matches**: `tsc`, `npx tsc`, `eslint`, `npx eslint`, `ruff check`.
- **Parsing Logic**:
  - Clean runs (exitCode 0) -> condensed to `✅ No lint/type errors found`.
  - Errors found:
    - Strips: ASCII decorative headers, file summary rows with 0 errors.
    - Preserves: file path, line:col, error code, and error description.
    - Groups errors by file path.

---

### 2.8 `GenericFallbackAdapter`
- **Matches**: Any command output with $> 35$ lines that does not match a specialized adapter.
- **Algorithm (Head & Tail Smart Truncate)**:
  - Keep first 10 lines (command initialization, banner, configuration).
  - Inject separator:
    ```text
    ... [skim: 412 lines omitted. Full log archived at .claude/skim/runs/run-XYZ.log] ...
    ```
  - Keep last 25 lines (tail usually contains the error summary, stack trace, or final status).
