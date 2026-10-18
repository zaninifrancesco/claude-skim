# ⚡ Claude Skim

[![Local processing](https://img.shields.io/badge/processing-100%25%20local-brightgreen)](#privacy)
[![Runtime dependencies](https://img.shields.io/badge/runtime%20dependencies-zero-blue)](#development)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**Skim the noise, keep the signal.**

A Claude Code Function Hooks plugin that filters known noisy Bash outputs using
local TypeScript heuristics. Every modified result links to an archived copy of
the full raw output. No network requests, external models or API keys are used
by the plugin.

## Install once

Inside Claude Code, run:

```text
/plugin install skim --marketplace zaninifrancesco/claude-skim
/reload-plugins
```

Skim is enabled automatically. Keep using Claude Code normally: no API keys,
`.env` files, manual npm commands, build step or per-session flags are needed.
The one-command marketplace installer requires Claude Code 2.1.275 or later
with Function Hooks support.

Alternatively, install persistently for your user from a terminal:

```bash
claude plugin marketplace add zaninifrancesco/claude-skim
claude plugin install skim@claude-skim --scope user
```

Reload plugins in any already-open session after installing. Start future
sessions with the usual `claude` command from any project.

For local development only, `claude --plugin-dir /path/to/claude-skim` still
loads the checked-out plugin for one session.

## Supported output

- **Jest / Vitest:** compact passing summaries; preserve failing test names,
  assertion diffs, source snippets and stack traces.
- **Cargo test / check / build:** compact passing Rust test targets and compilation
  progress; preserve failed tests, panic backtraces and compiler diagnostics.
- **Pytest / unittest:** remove passing progress output; preserve failure and
  collection-error blocks, tracebacks and summaries.
- **Java (Maven / Gradle / JUnit):** compact verbose dependency download tickers, plugin executions, and passing test suites; preserve `[ERROR] Failures:` blocks, Gradle task failures, assertion diffs, and full stack traces.
- **npm / pnpm / yarn / pip / Poetry:** remove recognized installation progress;
  preserve package counts, security summaries, unknown messages and fatal errors.
- **TypeScript / ESLint / Ruff / Flake8:** remove known compiler banners;
  preserve diagnostic paths, line numbers, source excerpts, rules and warnings.

The Go adapter is not implemented. Unknown commands, shell pipelines
and compound commands pass through unchanged. The generic head/tail adapter
is tested as a standalone parser and is deliberately excluded from automatic
routing to honor the safety rules in [AGENTS.md](AGENTS.md).

## Behavior

Pruning requires at least **30 lines and 1,500 characters**. Short, unknown,
binary, image, background, interrupted or externally persisted outputs pass
through unchanged. Permission failures and hard tool errors also pass through.

Only recognized noise is removed. Ambiguous formats are retained. A parser or
archive failure returns the original answer. If the footer would erase the
token savings, the original answer is returned too.

Every changed output includes a footer such as:

```text
[skim: condensed 350 lines -> 12 lines. Full raw log: .claude/skim/runs/run-<timestamp>-<id>.log]
```

Raw stdout followed by raw stderr is written without text normalization before
any modified answer is returned. Archives remain in `.claude/skim/runs/` until
you remove them; automatic retention cleanup is not implemented.

## Commands

- `/skim` or `/skim stats`: session and lifetime savings, reduction and adapter breakdown.
- `/skim raw`: latest session archive path and its complete original contents.
- `/skim toggle`: persistently pause or resume pruning.
- `/skim help`: command reference.

Claude Code adds the `skim:` prefix and controls the notification icon/style.
The plugin keeps the lightning symbol and supplies the status text once.
The status badge updates after pruning and on turn completion:

```text
skim: ⚡ -54.2k tokens (~$0.16) · 14 logs skimmed
```

`/skim stats` displays a Markdown table with session savings, skimmed runs,
average reduction and lifetime savings, followed by a tool breakdown.
`/skim help` uses a Markdown command list. Neither output relies on raw
Unicode borders or fixed-width padding. The figures above
are illustrative estimates, not measured billing credits.

The status badge updates after pruning and on turn completion. Token estimates
use `ceil(characters / 3.5)` per stream. Savings include the archive footer and
use a fixed $3 per million input tokens for the approximate dollar figure.
Lifetime counters assume one active session per plugin store. Filtering is local
and deterministic; latency varies with the output size and local filesystem,
so no fixed installation duration or universal sub-3ms runtime is promised.

## Privacy

Processing, archives and metrics stay local. The runtime has no external
package dependencies and performs no HTTP requests or subprocess calls.
`node_modules/`, `dist/` and `.claude/skim/` are excluded from Git.

## Development

```bash
npm ci
npm test
npm run lint
npm run build
claude plugin validate . --strict
```

Vitest tests use synthetic terminal logs in [fixtures/](fixtures/) and cover
passing summaries, full failure blocks, stream accounting, raw archiving,
pass-through rules, hook registration and slash commands. Runtime code uses
only the host API and JavaScript built-ins.

The shipped hooks follow the bundled runtime declarations: slash command
handlers use `command.run`, session shutdown uses `classic.SessionEnd`, and
filesystem operations are declared at the hook call sites for permission
analysis. See [specs/](specs/) and the [completed backlog](specs/07_TASK_BACKLOG.md).

## License

MIT © 2026 Francesco Zanini
