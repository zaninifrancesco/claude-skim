# 06 - Testing & Verification Specification

## 1. Testing Philosophy (Strict TDD)

Because `claude-skim` manipulates text fed directly into Claude's cognitive context, parser errors could mislead the model. Therefore:
1. Every adapter MUST have 100% test coverage using real-world terminal fixtures.
2. Every test suite must verify both **happy path (all pass)** and **failure path (error handling)**.
3. Assertions must guarantee that **zero failure diagnostic data** is stripped.

---

## 2. Test Architecture

```text
tests/
├── fixtures/                    # Raw real-world terminal dumps
│   ├── jest-failing.txt
│   ├── jest-passing.txt
│   ├── pytest-failing.txt
│   ├── pytest-passing.txt
│   ├── npm-install.txt
│   └── tsc-errors.txt
├── adapters/
│   ├── jest-vitest.test.ts
│   ├── pytest.test.ts
│   ├── cargo.test.ts
│   ├── package-manager.test.ts
│   ├── compiler.test.ts
│   └── fallback.test.ts
├── engine.test.ts               # Decision pipeline & bypass logic
├── archiver.test.ts             # File writing & naming
└── metrics.test.ts              # Token & dollar calculations
```

---

## 3. Required Test Cases per Adapter

### 3.1 `JestVitestAdapter`
- `should condense a 200-test passing suite into a single summary line`:
  - Input: 350 lines of passing tests.
  - Expected: $\le 2$ lines, token reduction $\ge 90\%$.
- `should preserve 100% of failing test assertion diffs and user stack traces`:
  - Input: 1 failing test among 50 passing tests.
  - Expected: Output contains `FAIL`, exact assertion error, line numbers, but contains NO passing test checkmarks (`✓`).

### 3.2 `PytestAdapter`
- `should condense all-passing pytest runs`:
  - Strips dots matrix, retains final `X passed in Ys`.
- `should preserve full traceback in failed pytest runs`:
  - Retains `=== FAILURES ===` block and exception message.

### 3.3 `PackageManagerAdapter`
- `should strip npm download tickers and retain package addition count`:
  - Retains `added X packages...`.

### 3.4 `GenericFallbackAdapter`
- `should truncate arbitrary 500-line logs retaining head and tail`:
  - Retains first 10 lines + last 25 lines + truncation marker.

---

## 4. Plugin Validation

Before considering implementation complete, the plugin must pass the official Claude Code validator:
```bash
claude plugin validate .
```
- Exit status: `0` (passed).
- Reported footprint: `reads files`, `writes files`, `draws`.
- Zero validation errors.
