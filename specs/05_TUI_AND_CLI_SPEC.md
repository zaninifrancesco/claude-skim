# 05 - Terminal UI & Slash Commands Specification

## 1. Status Bar Specification (`$.ui.status`)

Rendered continuously above the Claude Code prompt input box. Updated on every `turn.complete` and after every pruned `tool.call`.

### Status Bar Format:
```text
⚡ Skim: -48.2k tokens (~$0.14) · 12 logs skimmed
```

- When 0 tokens saved in the current session:
  ```text
  ⚡ Skim: Active (monitoring stdout)
  ```
- When toggled off:
  ```text
  ⚡ Skim: [Paused] (/skim toggle)
  ```

---

## 2. Slash Command Specification (`/skim`)

Registered via `$.command.register` during `session.start`:

### 2.1 `/skim` or `/skim stats`
Prints a formatted summary card to the transcript:

```text
╭─────────────────────────────────────────────────────────────╮
│  ⚡ Skim Savings Report                                      │
├─────────────────────────────────────────────────────────────┤
│  Session Tokens Saved:    54,210 tokens (~$0.16)            │
│  Session Logs Skimmed:     14 command runs                   │
│  Average Reduction:       78.4%                             │
│                                                             │
│  Breakdown by Adapter:                                      │
│    • Jest / Vitest:       8 runs  (-38,400 tokens)          │
│    • npm / pnpm:          3 runs  (-11,200 tokens)          │
│    • TypeScript (tsc):    2 runs   (-3,800 tokens)          │
│    • Fallback:            1 run      (-810 tokens)          │
│                                                             │
│  Lifetime Savings:        1.42M tokens (~$4.26 saved)       │
│  Archive Directory:       .claude/skim/runs/                │
╰─────────────────────────────────────────────────────────────╯
```

### 2.2 `/skim raw`
Displays the full path to the most recently pruned log file and prints its complete original contents, allowing the developer to inspect uncompressed output without leaving the terminal.

### 2.3 `/skim toggle`
Toggles pruning ON or OFF:
- If turning OFF: `$.ui.toast('Skim: Paused. Raw stdout will pass to Claude untouched.');`
- If turning ON: `$.ui.toast('Skim: Active. Pruning enabled.');`

### 2.4 `/skim help`
Prints command usage and configuration options.
