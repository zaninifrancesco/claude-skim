import type { EngineInterface } from 'claude-code';

export async function archiveRawOutput(
  fs: Pick<EngineInterface['fs'], 'write'>,
  stdout: string,
  stderr = '',
): Promise<string | undefined> {
  try {
    const id = crypto.randomUUID().replaceAll('-', '');
    const path = `.claude/skim/runs/run-${Date.now()}-${id}.log`;
    await fs.write(path, stdout + stderr);
    return path;
  } catch {
    // No archive means no pruning: the engine must return the original answer.
    return undefined;
  }
}
