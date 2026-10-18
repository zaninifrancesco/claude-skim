import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { archiveRawOutput } from '../src/archiver.js';

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
  vi.restoreAllMocks();
});

describe('raw archives', () => {
  it('writes unmodified stdout and stderr into the archive directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'skim-test-'));
    directories.push(root);
    const fs = { write: async (path: string, content: string) => {
      const target = join(root, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content);
    } };
    const stdout = '\u001b[32mPASS\u001b[0m\r\nraw output\n';
    const stderr = 'Error: café\n  at src/auth.ts:42:1\n';
    const path = await archiveRawOutput(fs, stdout, stderr);
    expect(path).toMatch(/^\.claude\/skim\/runs\/run-\d+-[a-f0-9]+\.log$/);
    expect(await readFile(join(root, path!), 'utf8')).toBe(stdout + stderr);
  });

  it('gives concurrent runs unique paths even at the same timestamp', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_234);
    const fs = { write: vi.fn().mockResolvedValue(undefined) };
    const paths = await Promise.all(Array.from({ length: 50 }, () => archiveRawOutput(fs, 'same')));
    expect(new Set(paths).size).toBe(50);
    expect(fs.write).toHaveBeenCalledTimes(50);
    expect(fs.write.mock.calls[0]?.[1]).toBe('same');
  });

  it('returns no path if archiving fails, so the caller can pass through', async () => {
    const fs = { write: vi.fn().mockRejectedValue(new Error('EACCES')) };
    await expect(archiveRawOutput(fs, 'raw')).resolves.toBeUndefined();
  });
});
