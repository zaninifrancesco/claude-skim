# Proposed submission: Skim

Local draft for a future pull request to `karanb192/awesome-claude-code-mods`.
No upstream contribution has been submitted. Check the upstream contribution
instructions and current category layout before opening the pull request.

## Title

Add Skim: local filtering of noisy Bash output

## Suggested entry

- [Skim](https://github.com/zaninifrancesco/claude-skim) — Filters recognized test,
  package installation and compiler output locally, retaining failure diagnostics
  and linking every modified result to the full raw log. Zero runtime dependencies.

## Pull request description

Adds Skim, a Claude Code Function Hooks plugin for reducing repetitive Bash
output with deterministic TypeScript parsers. It supports Jest/Vitest,
Pytest/unittest, common package managers and compiler/linter output.

Unknown commands and ambiguous formats pass through unchanged. Modified
results are returned only after the raw output is archived locally. The plugin
also provides `/skim stats`, `/skim raw`, `/skim toggle` and a savings badge.

Validation: Vitest suite, TypeScript typecheck/build and
`claude plugin validate . --strict`. Installation and supported behavior are
documented in the repository README. Function Hooks API support is required.
