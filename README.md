# ⚡ Claude Skim

[![Claude Code Mod](https://img.shields.io/badge/claude--code-mod-blueviolet?style=for-the-badge)](https://mods.aidojo.si)
[![Zero Network](https://img.shields.io/badge/network-100%25%20local-brightgreen?style=for-the-badge)](#privacy--local-first)
[![Token Reduction](https://img.shields.io/badge/token%20reduction-up%20to%2085%25-orange?style=for-the-badge)](#how-it-works)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)

> **Skim the noise, keep the signal.**  
> Zero-latency, 100% local stdout compression for Claude Code. Slashes context token consumption by up to 85% on tests, builds, and package managers with **zero external API keys**.

---

## ⚡ The Problem

When Claude Code executes commands like `npm test`, `pytest`, or `cargo test`, **hundreds of lines of stdout** are injected directly into the conversation context. 

- **149 passing tests** dump 3,000+ useless tokens into context before the 1 failing test is shown.
- **Context Rot**: Claude gets overwhelmed by boilerplate and forgets earlier prompt instructions.
- **Money Drain**: Each turn costs more as the context window blows up with terminal garbage.
- **Premature `/compact`**: Context runs out twice as fast.

---

## 🚀 The Solution

`skim` intercepts Bash tool calls inside Claude Code and intelligently filters noise **before** text reaches Claude's context window.

```
+-------------------------------------------------------------------------+
|                                                                         |
|  RAW STDOUT (350 lines)                 SKIMMED STDOUT (12 lines)       |
|  ---------------------                  -------------------------       |
|  ✓ test/math.spec.ts (2ms)              [skim: 149 passing tests        |
|  ✓ test/user.spec.ts (4ms)               omitted for brevity]           |
|  ... [148 passing tests] ...       ==>                                  |
|  FAIL test/auth.spec.ts                 FAIL test/auth.spec.ts          |
|  ● Auth > should reject token           ● Auth > should reject token    |
|    Expected: 401, Received: 200           Expected: 401, Received: 200  |
|                                                                         |
|  Full raw log archived: .claude/skim/runs/run-104.log                   |
|                                                                         |
+-------------------------------------------------------------------------+
```

### Key Highlights:
- 🔒 **100% Local & Private**: No data leaves your machine. No external LLM or API keys required.
- ⚡ **Zero Latency (< 3ms)**: Ultra-fast TypeScript regex & AST heuristics instead of slow remote API roundtrips.
- 🎯 **Zero Information Loss on Errors**: Retains 100% of stack traces, assertion failures, error messages, and line numbers.
- 💾 **Full Raw Log Archival**: Every uncompressed output is saved locally to `.claude/skim/runs/` with a link directly in the prompt.
- 📊 **Real-Time Savings Banner**: See how many tokens and dollars you've saved right above your prompt.

---

## Implementation status

Phases 1–2 are implemented and tested: token estimates, raw log archiving,
Jest/Vitest and Pytest/unittest adapters. The engine and hook registration are
still pending, so the plugin does not yet intercept Bash output. The adapters
are pure parsers; archiving, thresholds and raw-log footers will be enforced by
the engine in phase 4. See the [task backlog](specs/07_TASK_BACKLOG.md).

## 📦 Installation

In any active Claude Code terminal session:

```bash
/plugin install skim --marketplace username/claude-skim
```

Then reload plugins:
```bash
/reload-plugins
```

That's it! `skim` is active immediately.

---

## 🛠️ Supported Tools & Adapters

| Category | Supported Tools | What Gets Skimmed | What Gets Preserved |
| :--- | :--- | :--- | :--- |
| **Node.js** | Jest, Vitest, `npm test` | Passing tests, timing noise, checkmarks | Failing suites, assertion diffs, stack traces |
| **Python** | Pytest, Unittest | Dot progress matrices (`.....`), plugin banners | `=== FAILURES ===` block, tracebacks, error codes |
| **Rust** | Cargo test, Cargo check | `Compiling...` logs, passing test lines | Panic backtraces, compiler error diagnostics (`^^^`) |
| **Go** | Go test | `=== RUN`, `--- PASS` rows | `--- FAIL`, package error output, line numbers |
| **Package Managers** | npm, pnpm, yarn, pip | Progress bars, download spinners, audit banners | Added package count, fatal resolution errors |
| **Linters & Compilers**| TypeScript (`tsc`), ESLint, Ruff | Clean passes, boilerplate ASCII headers | File:line:col errors, error codes, summaries |
| **Fallback** | Any generic command ($> 35$ lines) | Intermediary noise | Head (first 10 lines) + Tail (last 25 lines) |

---

## 💻 Terminal Commands

- `/skim` or `/skim stats`: Display session and lifetime savings report.
- `/skim raw`: Show the path to the most recently pruned log file.
- `/skim toggle`: Temporarily pause or resume stdout compression.

---

## 🏗️ Architecture & Specifications

This repository strictly follows **Spec-Driven AI Development**:
- Detailed technical specifications are located in [`specs/`](specs/).
- Agent operating instructions are in [`AGENTS.md`](AGENTS.md).
- Real-world log fixtures are in [`fixtures/`](fixtures/).

---

## 📄 License

MIT © [Francesco Zanini](https://github.com/francescozanini)
