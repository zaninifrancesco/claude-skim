# 05 - Terminal UI & Slash Commands Specification

## 1. Status Bar Specification (`$.ui.status`)

Rendered continuously above the Claude Code prompt input box. Updated on every `turn.complete` and after every pruned `tool.call`.

### Status Bar Format:
```text
skim: ⚡ -48.2k tokens (~$0.14) · 12 logs skimmed
```

- When 0 tokens saved in the current session:
  ```text
  skim: ⚡ Active (monitoring stdout)
  ```
- When toggled off:
  ```text
  skim: ⚡ [Paused] (/skim toggle)
  ```

---

## 2. Slash Command Specification (`/skim`)

Registered via `$.command.register` during `session.start`.

> ⚠️ **CRITICAL RENDERING RULE (Desktop vs Terminal)**:
> In Claude Desktop, plain text in the transcript is rendered using a **proportional font** (variable-width), NOT a monospace font.
> If you output raw Unicode box characters (`╭`, `│`, `─`) as plain text, **the borders will disconnect and columns will misalign**.
> 
> To guarantee crisp, beautiful rendering on **BOTH** Claude Desktop and Terminal, use one of the two standard formats below:

### 2.1 Option A (Recommended): Native GitHub-Flavored Markdown Table
Claude Desktop renders this into a sleek native HTML table, while Claude Code Terminal renders it with native terminal grid lines.

```markdown
### ⚡ Skim Savings Report

| Metric | Details |
| :--- | :--- |
| **Session Saved** | `54,210` tokens (~$0.16) |
| **Logs Skimmed** | `14` command runs (78.4% reduction) |
| **Lifetime Saved** | `1.42M` tokens (~$4.26) |
| **Archive Directory** | `.claude/skim/runs/` |

**Breakdown by Tool:**
- **Jest / Vitest:** 8 runs `(-38.4k tokens)`
- **npm / pnpm:** 3 runs `(-11.2k tokens)`
- **TypeScript (tsc):** 2 runs `(-3.8k tokens)`
- **Fallback:** 1 run `(-810 tokens)`
```

---

### 2.2 Option B: Fenced Code Block (Forces Monospace on Desktop)
If a boxed CLI aesthetic is desired, the output **MUST be wrapped in triple backticks** (` ```text `) so Claude Desktop renders it inside a `<pre><code>` block with fixed-width monospace font (Menlo/Consolas):

````markdown
```text
┌─────────────────────────────────────────────────────────────┐
│  [SKIM] Savings Report                                      │
├─────────────────────────────────────────────────────────────┤
│  Session Tokens Saved:    54,210 tokens (~$0.16)            │
│  Session Logs Skimmed:    14 command runs                   │
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
└─────────────────────────────────────────────────────────────┘
```
````

*(Note: In fixed-width code blocks, avoid variable-width emojis like `⚡` on the header border, or replace with `[SKIM]` to prevent 1-column vs 2-column terminal padding discrepancies).*

---

### 2.3 Option C: Modern Borderless CLI List (Bullet Card)
Minimalist, elegant, and 100% resilient across any window resizing or mobile view:

```markdown
**⚡ Skim Savings Report**
• **Session Saved:** `54,210 tokens` (~$0.16)
• **Logs Skimmed:** `14 runs` (78.4% reduction)
• **Lifetime Saved:** `1.42M tokens` (~$4.26)
• **Archive:** `.claude/skim/runs/`

**Tool Breakdown:**
  ▸ Jest / Vitest: 8 runs `(-38.4k tokens)`
  ▸ npm / pnpm: 3 runs `(-11.2k tokens)`
  ▸ TypeScript (tsc): 2 runs `(-3.8k tokens)`
```

---

## 3. Subcommands

### 3.1 `/skim raw`
Displays the full path to the most recently pruned log file and prints its complete original contents, allowing the developer to inspect uncompressed output without leaving the terminal.

### 3.2 `/skim toggle`
Toggles pruning ON or OFF:
- If turning OFF: `$.ui.toast('Skim: Paused. Raw stdout will pass to Claude untouched.');`
- If turning ON: `$.ui.toast('Skim: Active. Pruning enabled.');`

### 3.3 `/skim help`
Prints command usage formatted as a clean markdown list:
```markdown
**Skim Commands:**
• `/skim` or `/skim stats` — View session & lifetime savings report
• `/skim raw` — Inspect latest uncompressed log in full
• `/skim toggle` — Pause or resume stdout pruning
• `/skim help` — Show this help message
```
