#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { pendingRuns } from './executor/ps-runner.js';

async function main(): Promise<void> {
  const server = createServer();
  await server.connect(new StdioServerTransport());

  // Let a running conversion finish (and restore Vector Magic's settings) before exiting.
  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    const deadline = Date.now() + 120_000;
    while (pendingRuns() > 0 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 250));
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
