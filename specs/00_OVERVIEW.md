# 00 - Product Overview & Strategic Charter

## 1. Vision & Executive Summary

**claude-skim** (Plugin: `skim`) is an open-source Claude Code mod (Function Hooks plugin) that autonomously skims off noisy, high-volume terminal output (`stdout`/`stderr`) before it enters Claude's model context window.

By utilizing deterministic, zero-latency local heuristic parsers across major developer toolchains (Test Runners, Package Managers, Compilers, Linters, Build Systems), it reduces token consumption by **60% to 85%** on command executions, mitigates model attention drift ("context rot"), and prevents premature `/compact` operations.

---

## 2. Problem Statement

Modern CLI developer workflows generate massive volumes of conversational noise:
1. **Test Suites** (`npm test`, `pytest`, `cargo test`): Often output 200–2,000 lines. When 149 tests pass and 1 fails, Claude Code feeds all 150 test outputs into the prompt. 98% of those tokens provide zero diagnostic value.
2. **Package Installations** (`npm install`, `pip install`, `yarn add`): Emit download progress bars, fetch spinners, deprecation notices, and dependency resolution trees that fill 5,000+ tokens.
3. **Build & Bundler Output** (`tsc`, `next build`, `webpack`, `vite`): Emit chunk listings, asset tables, and non-fatal lint warnings.
4. **Economic & Cognitive Drag**:
   - Claude's prompt cache and input tokens cost real money. High token burns drain user budgets.
   - Long contexts trigger the "lost in the middle" phenomenon: Claude forgets instructions established in earlier turns.
   - Frequent context overflow forces `/compact`, losing previous reasoning traces.

---

## 3. Competitive Landscape & Our Unfair Advantage

| Feature | `tamaratran/jev-pruner` (`fast-jev-output`) | `GhalebDweikat/winnow` | **`claude-skim` (This Project)** |
| :--- | :--- | :--- | :--- |
| **Execution Model** | Remote HTTP API call to Jev | Remote LLM call | **100% Local Heuristics / Regex / AST** |
| **Latency** | 1.5s - 4.0s (network roundtrip) | 2.0s - 5.0s | **< 3ms (Instant)** |
| **External API Key** | Required (`TYPESAFE_API_KEY`) | Required | **None (Zero Configuration)** |
| **Privacy / Security** | Output sent to third-party server | Output sent to third-party | **Zero Data Egress (Air-gapped safe)** |
| **Cost** | Third-party subscription/credits | API usage costs | **Free & Open Source forever** |
| **Auditability** | Black-box LLM summarization | Black-box LLM | **Full raw log archived locally** |

---

## 4. Value Proposition & Target Personas

### Value Proposition:
- **Skim the Noise, Keep the Signal**: Cuts 50k–200k tokens per coding day, saving ~$0.50 to $3.00/day per active developer.
- **Smarter Agent**: Keeps the context clean, allowing Claude to focus exclusively on failure tracebacks and actionable diffs.
- **Zero Friction**: One command installation:
  ```bash
  /plugin install skim --marketplace username/claude-skim
  ```

### Target Personas:
- Full-stack engineers running iterative TDD (TypeScript, Python, Go, Rust).
- Developers working in large monorepos where build and test logs are massive.
- Cost-conscious AI developers looking to maximize their Claude subscription limits.

---

## 5. Success Metrics (Target Milestones)

- **Token Reduction**: $\ge 75\%$ average token reduction on test suite and package manager runs.
- **Speed**: Processing latency $< 10\text{ ms}$ for logs up to 10,000 lines.
- **Accuracy**: $100\%$ retention of failing test names, stack traces, and compiler errors (zero false negatives).
- **GitHub Adoption**: 1,000+ Stars within 60 days of launch, inclusion in `mods.aidojo.si` featured list.
