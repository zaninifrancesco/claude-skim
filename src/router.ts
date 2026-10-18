import { CargoTestAdapter } from './adapters/cargo.js';
import { JestVitestAdapter } from './adapters/jest-vitest.js';
import { PytestAdapter } from './adapters/pytest.js';
import { PackageManagerAdapter } from './adapters/package-manager.js';
import { CompilerLinterAdapter } from './adapters/compiler.js';
import type { ToolAdapter } from './adapters/types.js';

const adapters: ToolAdapter[] = [new JestVitestAdapter(), new CargoTestAdapter(), new PytestAdapter(), new PackageManagerAdapter(), new CompilerLinterAdapter()];

export function routeCommand(command: string, stdout: string, stderr?: string): ToolAdapter | undefined {
  // AGENTS.md requires unknown commands to pass through, without generic truncation.
  return adapters.find((adapter) => adapter.canHandle(command, stdout, stderr));
}
