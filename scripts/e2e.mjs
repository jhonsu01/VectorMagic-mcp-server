// End-to-end test over real MCP stdio against dist/bundle.cjs (what the .mcpb runs).
// Needs Windows + Vector Magic installed. Usage: npm run build && npm run test:e2e
// E2E_BUNDLE=<path to bundle.cjs> tests another build (e.g. the contents of an unpacked .mcpb).
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtempSync, existsSync, statSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';

const out = mkdtempSync(join(tmpdir(), 'vm-e2e-'));
const client = new Client({ name: 'e2e', version: '1.0.0' });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [process.env.E2E_BUNDLE || 'dist/bundle.cjs'] }));

let failed = 0;
const check = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failed++; };
const parse = (res) => JSON.parse(res.content.find((c) => c.type === 'text').text);

const { tools } = await client.listTools();
check(tools.length === 3, `3 tools exposed (${tools.map((t) => t.name).join(', ')})`);

const status = parse(await client.callTool({ name: 'get_vector_magic_status', arguments: {} }));
check(status.installed, `Vector Magic found at ${status.exe_path} (v${status.version})`);
const samples = join(dirname(status.exe_path), 'Samples');

const t0 = Date.now();
const single = await client.callTool({
  name: 'vectorize_image',
  arguments: { input_path: join(samples, 'Logo With Blending.png'), output_path: join(out, 'logo.svg'), detail: 'medium' },
});
const s = parse(single);
check(s.success && existsSync(s.output_path) && statSync(s.output_path).size > 1000, `vectorize_image -> ${s.output_path} (${s.bytes} B, ${Date.now() - t0} ms)`);
check(/,\s*(med|mit|moy)/i.test(s.vector_magic_summary ?? ''), `summary reflects detail=medium: "${s.vector_magic_summary}"`);
const img = single.content.find((c) => c.type === 'image');
check(!!img && img.data.length > 1000, 'preview image returned');
if (img) writeFileSync(join(out, 'preview.png'), Buffer.from(img.data, 'base64'));

const again = parse(await client.callTool({ name: 'vectorize_image', arguments: { input_path: join(samples, 'Logo With Blending.png'), output_path: join(out, 'logo.svg') } }));
check(!again.success && /already exists/.test(again.error), 'refuses to overwrite without overwrite:true');

const batch = parse(await client.callTool({
  name: 'vectorize_batch',
  arguments: { input_dir: samples, output_dir: join(out, 'batch'), format: 'eps', shape_mode: 'adjoining_grouped' },
}));
check(batch.total === 4 && batch.succeeded === 4, `vectorize_batch: ${batch.succeeded}/${batch.total} EPS`);

const bad = parse(await client.callTool({ name: 'vectorize_image', arguments: { input_path: join(samples, 'readme.txt') } }));
check(!bad.success && /Unsupported input/.test(bad.error), 'rejects unsupported input');

await client.close();
console.log(`\nOutputs in ${out}`);
process.exit(failed ? 1 : 0);
