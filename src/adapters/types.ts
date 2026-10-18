export interface PruneResult {
  condensedStdout: string;
  condensedStderr?: string;
  originalTokens: number;
  condensedTokens: number;
  tokensSaved: number;
  linesRemoved: number;
  matchedAdapter: string;
}

export interface ToolAdapter {
  readonly name: string;
  canHandle(command: string, stdout: string, stderr?: string): boolean;
  prune(stdout: string, stderr?: string): PruneResult;
}
