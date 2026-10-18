# 01 - System Architecture & Pipeline Design

> Implementation precedence: unknown commands pass through unchanged; the generic
> fallback is standalone. The minimum line threshold is 30 (`AGENTS.md`).

## 1. High-Level Architecture

`claude-skim` is implemented as an in-process Claude Code Function Hooks plugin. It does not spawn background daemon processes; it hooks synchronously into the Claude Code event loop via `register.ts`.

```
+------------------------------------------------------------------------+
|                          Claude Code Engine                            |
|                                                                        |
|  [User Prompt] ---> [Model Generates Tool Call: Bash(command)]         |
|                                   |                                    |
|                                   v                                    |
|              +------------------------------------------+              |
|              |         tool.call Hook (skim)            |              |
|              +------------------------------------------+              |
|                                   |                                    |
|                     next(event) executes Bash                          |
|                                   |                                    |
|                     Raw result: { stdout, stderr }                     |
|                                   |                                    |
|                                   v                                    |
|                   +-------------------------------+                    |
|                   |   Pipeline Decision Engine    |                    |
|                   +-------------------------------+                    |
|                      /            |             \                      |
|            Skip/Bypass     Adapter Matched     Generic Fallback        |
|                 |                 |                     |              |
|                 v                 v                     v              |
|           Return Intact    Adapter.prune()       Fallback.prune()      |
|                                   \                     /              |
|                                    +---------+---------+               |
|                                              |                         |
|                                              v                         |
|                             +---------------------------------+        |
|                             |   Archiver: Save Raw to Disk    |        |
|                             |   (.claude/skim/runs/<id>.log)  |        |
|                             +---------------------------------+        |
|                                              |                         |
|                                              v                         |
|                             +---------------------------------+        |
|                             |   Metrics: Update Token Counter |        |
|                             |   Update $.ui.status Banner     |        |
|                             +---------------------------------+        |
|                                              |                         |
|                                              v                         |
|                           Return Condensed Result to Model             |
+------------------------------------------------------------------------+
```

---

## 2. Component Breakdown

### 2.1 The Hook Entrypoint (`hooks/register.ts`)
- Registers on:
  - `session.start`: Initializes persistent store, resets session telemetry, mounts `/skim` slash command.
  - `tool.call` (`{ tool: "Bash" }`): Main interceptor.
  - `turn.complete`: Updates session status bar (`$.ui.status`).
  - `session.end`: Writes summary diagnostics to local store.

### 2.2 Pipeline Decision Engine (`src/engine.ts`)
Inspects the command string (`event.command`) and the output length to determine if pruning should occur:
- **Bypass Conditions** (returns original untouched):
  - Plugin is toggled off (`state.enabled === false`).
  - Command is in the bypass list (`cat`, `echo`, `head`, `tail`, `curl`, `wget`, `nano`, `vi`).
  - Output is below the threshold: `output.split('\n').length < MIN_LINE_THRESHOLD` (default: 30 lines) or `output.length < 1500 chars`.
  - Output appears to be binary or base64.
  - Tool execution produced a hard system error or denied permission.

### 2.3 Command Router (`src/router.ts`)
Matches the CLI command to a specialized adapter:
- **`JestVitestAdapter`**: Matches `jest`, `vitest`, `npm test`, `pnpm test`, `yarn test`.
- **`PytestAdapter`**: Matches `pytest`, `python -m unittest`, `python -m pytest`.
- **`GoTestAdapter`**: Matches `go test`.
- **`CargoTestAdapter`**: Matches `cargo test`, `cargo build`.
- **`PackageManagerAdapter`**: Matches `npm install`, `npm i`, `pnpm i`, `yarn add`, `pip install`, `poetry install`.
- **`CompilerLinterAdapter`**: Matches `tsc`, `eslint`, `ruff`, `flake8`.
- **`GenericFallbackAdapter`**: Standalone parser only; unknown commands pass through per `AGENTS.md`.

### 2.4 The Archiver (`src/archiver.ts`)
Whenever an output is modified:
- Computes a unique ID: `run-<timestamp>-<hash>.log`.
- Writes full raw stdout + stderr into `.claude/skim/runs/`.
- Appends a concise reference footer to the condensed output:
  ```text
  [skim: condensed 340 lines -> 18 lines. Full raw log: .claude/skim/runs/run-1729252000.log (-2,450 tokens)]
  ```

### 2.5 Metrics & Token Estimator (`src/metrics.ts`)
- Approximates token counts using the industry-standard heuristic:
  $$\text{tokens} \approx \frac{\text{characters}}{3.5}$$
- Tracks:
  - `sessionTokensSaved`: cumulative tokens saved in current session.
  - `sessionLogsPruned`: count of compressed command runs.
  - `lifetimeTokensSaved`: persisted via `$.store.set('skim_lifetime_tokens', ...)`.

---

## 3. Invariants & Safety Guarantees

1. **Zero False Negatives for Failures**:
   If an exit code is non-zero, or if regex detects `FAIL`, `AssertionError`, `Error:`, `panicked at`, `Exception`, the parser MUST retain:
   - The test identifier / file path.
   - The assertion diff / error message.
   - The stack trace lines directly pointing to user code.
2. **Deterministic & Isolated**:
   Adapters are pure functions `(command: string, rawStdout: string, rawStderr: string) => PruneResult`. They have no side effects, do not use network, and do not execute external processes.
3. **Graceful Fail-Safe**:
   If any parser throws an unexpected exception, it logs a warning via `$.ui.log` and returns the unmodified output:
   ```typescript
   try {
     return runPruningPipeline(command, record.stdout, record.stderr);
   } catch (err) {
     $.ui.log(`skim error: ${err}; falling back to raw output`);
     return answer;
   }
   ```
