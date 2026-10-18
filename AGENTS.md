# AGENTS.md - Developer & Agent Operating Instructions

> Welcome, Coding Agent. You are tasked with implementing and maintaining **`claude-skim`** (Plugin: `skim`).
> This document outlines the engineering principles, rules of engagement, and workflows you MUST follow.

---

## 1. Project Mission & Non-Negotiable Tenets

`claude-skim` is a high-performance, 100% local Claude Code mod (Function Hooks plugin). It intercepts verbose `Bash` tool outputs (e.g. test suites, package installations, compilers, linters) and skims off the noise before it reaches Claude's context window.

### Non-Negotiable Tenets:
1. **100% Local & Zero External Network Calls**:
   - NEVER make external HTTP requests or call external LLM APIs to summarize text.
   - All parsing, filtering, and reduction MUST be deterministic, instant (< 5ms), and done via TypeScript regex/AST heuristics.
2. **Zero Information Loss on Failures**:
   - On error or failed tests: NEVER discard stack traces, assertion messages, failing test names, or compilation error lines.
   - Only remove boilerplate noise: passing tests, progress bars, download tickers, bundle chunk lists, repeated separators.
3. **Always Archive the Raw Output**:
   - Every modified output MUST have its full raw content written to `.claude/skim/runs/<run-id>.log`.
   - Claude and the user must always be provided with the exact file path to review the raw log if needed.
4. **Safety & Pass-Through Guarantee**:
   - If a command is unknown, if parsing fails, or if output is under the threshold (`MIN_LINES_THRESHOLD = 30`), return `answer` UNTOUCHED.
   - Under no circumstances should an unexpected crash in a parser block the developer's session. Always wrap execution in `try / catch` with safe pass-through fallback.
5. **Strict Typing & Zero Runtime External Dependencies**:
   - The plugin runs inside Claude Code's sandboxed host. Runtime dependencies in `dependencies` must remain ZERO (`{}`). Only `devDependencies` (`typescript`, `vitest`, `@types/node`) are allowed for building and testing.

---

## 2. Specification Navigation

Before writing or modifying any code, read the specifications in `specs/`:

- [specs/00_OVERVIEW.md](specs/00_OVERVIEW.md) — Product vision, problem statement, competitive edge.
- [specs/01_ARCHITECTURE.md](specs/01_ARCHITECTURE.md) — System design, hook pipeline, lifecycle, and safety boundaries.
- [specs/02_HOOKS_AND_API_SPEC.md](specs/02_HOOKS_AND_API_SPEC.md) — Claude Code Hook interfaces, `register.ts`, and `$` API contract.
- [specs/03_ADAPTER_SPECIFICATIONS.md](specs/03_ADAPTER_SPECIFICATIONS.md) — Detailed parsing rules for Jest, Vitest, Pytest, Go, Cargo, npm, tsc, and Fallback.
- [specs/04_STATE_AND_METRICS.md](specs/04_STATE_AND_METRICS.md) — Token estimation, savings telemetry, and persistent state storage.
- [specs/05_TUI_AND_CLI_SPEC.md](specs/05_TUI_AND_CLI_SPEC.md) — Terminal UI (`$.ui.status`) and Slash command (`/skim`).
- [specs/06_TESTING_AND_VERIFICATION.md](specs/06_TESTING_AND_VERIFICATION.md) — Test-Driven Development (TDD) guidelines and fixtures.
- [specs/07_TASK_BACKLOG.md](specs/07_TASK_BACKLOG.md) — The prioritized checklist of tasks.

---

## 3. Workflow for Implementing Features

Follow **Spec-Driven & Test-Driven Development**:
1. Check [specs/07_TASK_BACKLOG.md](specs/07_TASK_BACKLOG.md) and pick the next uncompleted task `[ ]`.
2. Inspect the corresponding section in [specs/03_ADAPTER_SPECIFICATIONS.md](specs/03_ADAPTER_SPECIFICATIONS.md) or relevant spec file.
3. Add a synthetic fixture in `fixtures/` representing the noisy command output.
4. Write a failing unit test in `tests/` asserting that:
   - Passing output compresses down to 1-2 lines.
   - Failing output preserves 100% of the failure details while stripping passing lines.
   - The token estimation is accurate.
5. Implement the adapter in `src/adapters/`.
6. Run `npm test` and ensure all tests pass.
7. Mark the task as done `[x]` in `specs/07_TASK_BACKLOG.md`.

---

## 4. Useful Commands

```bash
# Run unit tests with vitest
npm test

# Run tests in watch mode
npm run test:watch

# Typecheck code
npm run lint

# Validate plugin manifest with Claude Code CLI
claude plugin validate .
```
