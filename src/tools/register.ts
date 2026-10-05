import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { resolveVectorMagicExe, TIMEOUTS } from '../config.js';
import { BITMAP_FORMATS, INPUT_EXTENSIONS, VECTOR_FORMATS, isSupportedInput } from '../formats.js';
import { prepareJob, publicResult, runJob, vectorizeOptionsSchema, debugDir } from './vectorize.js';

type Content = { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string };
type ToolResult = { content: Content[]; isError?: boolean };

const MAX_PREVIEW_BYTES = 3 * 1024 * 1024;

function json(obj: unknown, isError = false): ToolResult {
  const out: ToolResult = { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] };
  if (isError) out.isError = true;
  return out;
}

function errorResult(e: unknown): ToolResult {
  return json({ success: false, error: e instanceof Error ? e.message : String(e) }, true);
}

export function registerTools(server: McpServer): void {
  server.registerTool(
    'vectorize_image',
    {
      title: 'Vectorize image',
      description:
        'Convert a bitmap image (PNG, JPG, GIF, BMP, TIFF, PSD, TGA...) into an editable vector file with Vector Magic Desktop Edition. ' +
        'Uses Vector Magic\'s fully automatic mode, then optionally changes the level of detail and colour mode, and writes ' +
        'SVG, AI, EPS, PDF, DXF or EMF (or a re-rendered PNG/JPG/BMP/TIF). Returns the output path, a summary of what Vector Magic ' +
        'detected (image type, detail, number of colours) and a preview image of the vector result. Takes ~10-30 s per image; large photos take longer. ' +
        'Files are never overwritten unless overwrite is true.',
      inputSchema: {
        input_path: z.string().describe('Absolute path of the image to vectorize.'),
        output_path: z
          .string()
          .optional()
          .describe('Absolute output path. Default: next to the input with the format extension (adds _2, _3... instead of overwriting).'),
        ...vectorizeOptionsSchema,
        preview: z.boolean().default(true).describe('Return a PNG preview of the vector result (as shown by Vector Magic).'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args) => {
      try {
        const job = prepareJob(args.input_path, args, { outputPath: args.output_path }, args.preview);
        const r = await runJob(job);
        const content: Content[] = [{ type: 'text', text: JSON.stringify(publicResult(job, r, args.input_path), null, 2) }];
        const preview = r.previewPath ?? job.params.previewPath;
        if (preview && existsSync(preview)) {
          try {
            const buf = await fs.readFile(preview);
            if (args.preview && r.success && buf.length <= MAX_PREVIEW_BYTES) {
              content.push({ type: 'image', data: buf.toString('base64'), mimeType: 'image/png' });
            }
          } finally {
            await fs.rm(preview, { force: true }).catch(() => undefined);
          }
        }
        return r.success ? { content } : { content, isError: true };
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    'vectorize_batch',
    {
      title: 'Vectorize several images',
      description:
        'Vectorize many images in one call with the same options (one Vector Magic run per image, sequentially). ' +
        'Give either input_paths or input_dir (non-recursive; only supported image types are picked). ' +
        'Outputs go to output_dir, or next to each input. Returns one result per image; a failure does not stop the batch.',
      inputSchema: {
        input_paths: z.array(z.string()).max(200).optional().describe('Absolute paths of the images.'),
        input_dir: z.string().optional().describe('Absolute folder: every supported image directly inside it is vectorized.'),
        output_dir: z.string().optional().describe('Absolute folder for the results (created if missing). Default: next to each input.'),
        ...vectorizeOptionsSchema,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args) => {
      try {
        let inputs: string[] = args.input_paths ?? [];
        if (args.input_dir) {
          if (!path.win32.isAbsolute(args.input_dir) || !existsSync(args.input_dir)) throw new Error(`input_dir not found or not absolute: ${args.input_dir}`);
          inputs = inputs.concat(
            readdirSync(args.input_dir)
              .map((n) => path.join(args.input_dir as string, n))
              .filter((p) => statSync(p).isFile() && isSupportedInput(p))
              .sort(),
          );
        }
        if (inputs.length === 0) throw new Error('No input images: give input_paths or an input_dir containing supported images.');
        if (inputs.length > 200) throw new Error('At most 200 images per batch.');
        if (args.output_dir) {
          if (!path.win32.isAbsolute(args.output_dir)) throw new Error(`output_dir must be absolute: ${args.output_dir}`);
          await fs.mkdir(args.output_dir, { recursive: true });
        }
        const results: unknown[] = [];
        let ok = 0;
        for (const input of inputs) {
          try {
            const job = prepareJob(input, args, { outputDir: args.output_dir }, false);
            const r = await runJob(job);
            if (r.success) ok++;
            results.push(publicResult(job, r, input));
          } catch (e) {
            results.push({ success: false, input_path: input, error: e instanceof Error ? e.message : String(e) });
          }
        }
        return json({ success: ok === inputs.length, total: inputs.length, succeeded: ok, failed: inputs.length - ok, results }, ok === 0);
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    'get_vector_magic_status',
    {
      title: 'Vector Magic status',
      description:
        'Check that Vector Magic Desktop Edition is installed and usable: executable path, version, Vector Magic windows already open ' +
        '(the connector never touches them; it starts its own), supported input/output formats and timeouts.',
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      const exe = resolveVectorMagicExe();
      let version: string | undefined;
      if (exe.path) {
        const notes = path.join(path.dirname(exe.path), 'release_notes.txt');
        if (existsSync(notes)) version = /Version\s+([\d.]+)/.exec(readFileSync(notes, 'utf-8'))?.[1];
      }
      let openInstances = 0;
      if (process.platform === 'win32') {
        try {
          const out = execFileSync('tasklist.exe', ['/FI', 'IMAGENAME eq vmde.exe', '/FO', 'CSV', '/NH'], { encoding: 'utf-8', windowsHide: true });
          openInstances = out.split(/\r?\n/).filter((l) => /^"vmde\.exe"/i.test(l)).length;
        } catch {
          // tasklist unavailable: leave 0
        }
      }
      return json({
        installed: !!exe.path,
        exe_path: exe.path ?? null,
        exe_source: exe.source,
        searched: exe.path ? undefined : exe.tried,
        version: version ?? null,
        tested_version: '1.15',
        platform: process.platform,
        open_vector_magic_windows: openInstances,
        input_formats: INPUT_EXTENSIONS,
        output_formats: { vector: VECTOR_FORMATS, bitmap: BITMAP_FORMATS },
        timeouts_sec: TIMEOUTS,
        debug_snapshots_dir: debugDir(),
        hint: exe.path ? undefined : 'Install Vector Magic Desktop Edition or set VECTOR_MAGIC_EXE to the full path of vmde.exe.',
      }, !exe.path);
    },
  );
}
