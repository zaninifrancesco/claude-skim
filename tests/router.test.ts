import { describe, expect, it } from 'vitest';
import { routeCommand } from '../src/router.js';

describe('command router', () => {
  it.each([
    ['npm test', 'Jest / Vitest'], ['pytest', 'Pytest / unittest'],
    ['cargo test', 'Cargo'], ['npm install', 'Package managers'], ['npx tsc', 'Compilers / linters'],
  ])('routes %s to its specialized adapter', (command, name) => {
    expect(routeCommand(command, '')?.name).toBe(name);
  });
  it.each(['unknown build', 'cat log', 'curl localhost', 'npm test && cat file', 'go test'])('preserves unsupported commands instead of truncating them: %s', (command) => {
    expect(routeCommand(command, 'data\n'.repeat(500))).toBeUndefined();
  });
});
