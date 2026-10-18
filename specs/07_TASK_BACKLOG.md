# 07 - Development Task Backlog & Milestones

> This is the actionable execution checklist for the coding agent.
> Complete each task sequentially, following TDD. Check the box `[x]` upon completion.

---

## Phase 1: Core Foundation & Tooling Setup
- [x] **Task 1.1**: Initialize project configuration and verify `npm test` runs cleanly with `vitest`.
- [x] **Task 1.2**: Implement `src/utils/tokens.ts` (token estimation heuristic $\text{chars}/3.5$ and dollar savings formula).
- [x] **Task 1.3**: Add unit tests in `tests/metrics.test.ts` verifying token calculation bounds and edge cases (empty strings, large texts).
- [x] **Task 1.4**: Implement `src/archiver.ts` (file archiving logic saving raw output to `.claude/skim/runs/run-<timestamp>-<hash>.log`).
- [x] **Task 1.5**: Add unit tests in `tests/archiver.test.ts` testing file write operations and path formatting.

---

## Phase 2: Test Runner Adapters (Jest, Vitest, Pytest)
- [x] **Task 2.1**: Implement `src/adapters/jest-vitest.ts` matching `jest`, `vitest`, `npm test`, etc.
  - Passing path: collapse into one-line summary.
  - Failing path: strip passing lines, retain `FAIL`, assertion diffs, stack traces.
- [x] **Task 2.2**: Write unit tests in `tests/adapters/jest-vitest.test.ts` using fixtures (`fixtures/jest-passing.log`, `fixtures/jest-failing.log`).
- [x] **Task 2.3**: Implement `src/adapters/pytest.ts` matching `pytest`, `python -m unittest`.
  - Passing path: strip dot matrices, keep count.
  - Failing path: preserve `=== FAILURES ===` block and tracebacks.
- [x] **Task 2.4**: Write unit tests in `tests/adapters/pytest.test.ts` using fixtures (`fixtures/pytest-failing.log`).

---

## Phase 3: Package Managers, Compilers & Fallback
- [x] **Task 3.1**: Implement `src/adapters/package-manager.ts` (npm, pnpm, yarn, pip).
  - Strip progress bars, download spinners, audit banners; keep added package summary & fatal errors.
- [x] **Task 3.2**: Add unit tests in `tests/adapters/package-manager.test.ts` using `fixtures/npm-install.log`.
- [x] **Task 3.3**: Implement `src/adapters/compiler.ts` (`tsc`, `eslint`).
  - Keep file:line:col errors, strip boilerplate headers and passing file rows.
- [x] **Task 3.4**: Add unit tests in `tests/adapters/compiler.test.ts` using `fixtures/tsc-errors.log`.
- [x] **Task 3.5**: Implement `src/adapters/fallback.ts` (Head & Tail smart truncation for arbitrary $> 35$ line output).
- [x] **Task 3.6**: Add unit tests in `tests/adapters/fallback.test.ts`.

---

## Phase 4: Engine Pipeline & Command Router
- [x] **Task 4.1**: Implement `src/router.ts` (inspects command string and delegates to the appropriate adapter).
- [x] **Task 4.2**: Implement `src/engine.ts` (orchestrates bypass checks, adapter execution, raw archiving, and metric tracking).
- [x] **Task 4.3**: Add unit tests in `tests/engine.test.ts` verifying bypass rules (short output, `cat`, `curl`, disabled state).

---

## Phase 5: Hook Registration, UI & Slash Command
- [x] **Task 5.1**: Implement `hooks/register.ts`:
  - Hook `session.start`: load config from `$.store`, mount `/skim` slash command.
  - Hook `tool.call` (`{ tool: 'Bash' }`): invoke `engine.processToolCall()`.
  - Hook `turn.complete`: update `$.ui.status()` with real-time token savings.
  - Hook `session.end`: persist lifetime metrics into `$.store`.
- [x] **Task 5.2**: Implement Slash command handler for `/skim`:
  - `/skim stats`: print formatted summary card.
  - `/skim raw`: print path to latest archived log.
  - `/skim toggle`: pause/resume pruning.
- [x] **Task 5.3**: Run `npm run build` to compile TypeScript into `dist/`.

---

## Phase 6: Validation, Badges & GitHub Release
- [x] **Task 6.1**: Run `claude plugin validate .` and ensure 0 errors and reported footprint.
- [x] **Task 6.2**: Verify `README.md` formatting and badges.
- [x] **Task 6.3**: Prepare PR submission template for `karanb192/awesome-claude-code-mods`.

## Implementation notes

- `AGENTS.md` takes precedence: the minimum is 30 lines, and unknown commands
  pass through. The standalone fallback is not selected by the router.
- The bundled Claude Code 2.1.274 types expose `classic.SessionEnd` and
  `command.run`; the earlier `session.end` and command `handler` examples are
  superseded by those host interfaces.
- `claude plugin validate . --strict` verifies filesystem read/write and UI
  calls with zero errors and warnings. Calls to `$` stay in the hook module.
- Task 6.3 is a local draft in `docs/awesome-claude-code-mods-submission.md`;
  no upstream PR or release has been published.
- Go/Cargo adapters and automatic archive cleanup are outside this checklist.


## Phase 7: Zero-Configuration User Experience
- [ ] **Task 7.1**: Publishable marketplace manifest and one-command install documentation.
- [ ] **Task 7.2**: Add Cargo test/build/check parsing with failure-preserving fixtures and tests.
- [ ] **Task 7.3**: Match the savings badge and boxed report, and show the complete `/skim raw` log.
- [ ] **Task 7.4**: Validate installation in an isolated user configuration and run host integration tests.
