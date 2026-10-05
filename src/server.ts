import { readFileSync } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTools } from './tools/register.js';

/** serverInfo.version comes from package.json (reachable as ../package.json from dist/ and src/). */
export function readPackageVersion(): string {
  try {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(path.resolve(dir, '../package.json'), 'utf-8')) as { version?: unknown };
    if (typeof pkg.version === 'string' && pkg.version) return pkg.version;
  } catch {
    // package.json not shipped next to the bundle: still start
  }
  return '0.0.0-unknown';
}

export function createServer(): McpServer {
  const server = new McpServer(
    { name: 'vectormagic-mcp-server', version: readPackageVersion() },
    {
      instructions:
        'Vectorizes bitmap images with the locally installed Vector Magic Desktop Edition (Windows). ' +
        'Call get_vector_magic_status first if unsure the app is installed. Use vectorize_image for one image ' +
        '(returns a preview) and vectorize_batch for folders. Runs are sequential; each takes ~10-30 s.',
    },
  );
  registerTools(server);
  return server;
}
