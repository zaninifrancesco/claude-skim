# 02 - Claude Code Hooks & API Specification

> Runtime compatibility: `types/claude-code.d.ts` (Claude Code 2.1.274) is
> authoritative. Use `classic.SessionEnd` for shutdown, register command metadata
> with `$.command.register` and handle it with `on('command.run', ...)`.
> `$.store.get` returns `unknown`; `$.ui.status(undefined)` clears the badge.
> Host calls must appear in the hook module for static permission analysis.
> When replacing a tool result, omit the old `ref` and `text` so the host renders
> the new output. The examples below describe the original proposed interface.

## 1. Scope & Objective

This document defines the exact TypeScript interface contracts between **`claude-skim`** and the Claude Code runtime environment. The incoming coding agent must implement `hooks/register.ts` strictly complying with these signatures.

Type definitions are sourced from `types/claude-code.d.ts` (Claude Code Function Hooks API).

---

## 2. Hook Entrypoint Contract (`hooks/register.ts`)

```typescript
import type { Register, On, PluginOptions } from 'claude-code';

export const register: Register = (on: On, options: PluginOptions) => {
  // 1. Session Lifecycle Hooks
  on('session.start', async ($, event, next) => {
    // Initialize session state, mount /skim slash command, restore lifetime metrics
    return next(event);
  });

  on('session.end', async ($, event, next) => {
    // Persist final metrics to $.store
    return next(event);
  });

  // 2. Tool Interception Hook
  on('tool.call', { tool: 'Bash' }, async ($, event, next) => {
    // Intercept stdout/stderr post-execution
    const answer = await next(event);
    return handleBashToolResult($, event, answer);
  });

  // 3. Turn Status Update Hook
  on('turn.complete', async ($, event, next) => {
    // Update $.ui.status with latest token savings
    updateStatusBar($);
    return next(event);
  });
};
```

---

## 3. Tool Event & Result Data Structures

When `tool.call` fires for `{ tool: 'Bash' }`:

### Event Payload (`event`):
```typescript
interface BashToolCallEvent {
  tool: 'Bash';
  command: string; // The command line executed (e.g. "npm test", "pytest")
  cwd?: string;
  timeout?: number;
}
```

### Next Result (`answer`):
```typescript
interface ToolCallAnswer {
  deny?: string;       // Present if denied by user or another guard
  isError?: boolean;   // True if the tool execution itself crashed
  result?: {
    stdout: string;    // Raw standard output
    stderr?: string;   // Raw standard error
    exitCode?: number; // Command exit code (0 for success, >0 for error)
    persistedOutputPath?: string; // Optional path if Claude Code wrote large output to disk
  };
}
```

### Return Transformation:
If `skim` condenses the output, it MUST return a modified `ToolCallAnswer` with the replaced `stdout` and a note attached:
```typescript
return {
  ...answer,
  result: {
    ...answer.result,
    stdout: condensedStdout,
    stderr: condensedStderr, // if modified or cleaned
  }
};
```

---

## 4. Claude Code Host Services (`$` Object)

The hook handler receives the engine host `$` with the following capabilities:

### 4.1 UI Services (`$.ui`)
- `$.ui.status(text: string | null)`: Renders a sticky status bar line directly above the user prompt.
  - *Usage*: `$.ui.status('⚡ Skim: -42.8k tokens (~$0.51 saved) · 14 pruned');`
- `$.ui.toast(message: string)`: Emits a brief transient toast in the terminal.
  - *Usage*: `$.ui.toast('Skim: 380 lines compressed to 14 lines');`
- `$.ui.log(message: string)`: Appends an internal debug log message visible in session logs.

### 4.2 Slash Command (`$.command.register`)
- Registers slash command:
  ```typescript
  $.command.register({
    name: 'skim',
    description: 'Manage Skim token pruning and inspect savings',
    handler: async (args: string) => {
      // Handles subcommands: 'stats', 'raw', 'toggle', 'help'
    }
  });
  ```

### 4.3 Filesystem Access (`$.fs`)
- `$.fs.write(path: string, content: string): Promise<void>`
- `$.fs.read(path: string): Promise<string>`
- `$.fs.exists(path: string): Promise<boolean>`
- *Usage*: Used by the `Archiver` to write `.claude/skim/runs/run-<id>.log`.

### 4.4 Persistent Store (`$.store`)
- `$.store.get<T>(key: string): Promise<T | undefined>`
- `$.store.set<T>(key: string, value: T): Promise<void>`
- *Usage*: Storing `skim_lifetime_tokens`, `skim_lifetime_runs`, and user configuration flags (`enabled: boolean`).
