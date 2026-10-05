import { existsSync, statSync } from 'fs';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { TIMEOUTS, resolveVectorMagicExe } from '../config.js';
import { runEngine, type EngineParams, type EngineResult } from '../executor/ps-runner.js';
import {
  DXF_MODES, INPUT_EXTENSIONS, OUTPUT_FORMATS, SHAPE_MODES,
  isBitmapFormat, isSupportedInput, normalizeOutputFormat, type OutputFormat,
} from '../formats.js';
import { resolveOutputPath } from '../paths.js';

/** Options shared by vectorize_image and vectorize_batch. */
export const vectorizeOptionsSchema = {
  format: z
    .string()
    .default('svg')
    .describe(`Output format. Editable vector: svg, ai, eps, pdf, dxf, emf. Bitmap rendered from the vector result: png, jpg, bmp, tif. Default svg.`),
  detail: z
    .enum(['auto', 'high', 'medium', 'low'])
    .default('auto')
    .describe('Level of detail. auto = what Vector Magic picks (usually high). low gives simpler shapes and smoother curves; high keeps small details.'),
  colors: z
    .enum(['auto', 'unlimited'])
    .default('auto')
    .describe('auto = Vector Magic picks a reduced palette (best for logos and flat artwork). unlimited = keep every colour (photos, gradients).'),
  shape_mode: z
    .enum(['stacked', 'adjoining', 'adjoining_grouped'])
    .default('stacked')
    .describe('How shapes are arranged. stacked: shapes sit on top of each other (easiest to edit, no gaps). adjoining: shapes fit into cut-outs of the shapes below. adjoining_grouped: adjoining and grouped by colour.'),
  stroke_shapes: z
    .boolean()
    .default(false)
    .describe('Outline every shape boundary with a stroke of its own colour (hides hairline gaps in some viewers).'),
  dxf_mode: z
    .enum(['splines', 'few_lines', 'many_lines'])
    .default('splines')
    .describe('DXF only. splines: lines + bicubic splines (smallest, most faithful). few_lines / many_lines: curves flattened into straight segments for CAD/CNC software that does not read splines.'),
  bitmap_scale: z
    .union([z.literal(1), z.literal(2), z.literal(4)])
    .default(1)
    .describe('Bitmap formats only: render at 1x, 2x or 4x the original pixel size.'),
  overwrite: z.boolean().default(false).describe('Replace an existing output file. Without it, files are never overwritten.'),
  show_window: z
    .boolean()
    .default(false)
    .describe('Keep the Vector Magic window on screen while it works (debugging). By default it runs off-screen.'),
};

const optionsObject = z.object(vectorizeOptionsSchema);
export type VectorizeOptions = z.infer<typeof optionsObject>;

export function debugDir(): string {
  return path.join(os.tmpdir(), 'vectormagic-mcp-debug');
}

export interface PreparedJob {
  params: EngineParams;
  format: OutputFormat;
}

/** Validates input/format/output and builds the engine parameters. Throws Error with a user-facing message. */
export function prepareJob(
  inputPath: string,
  opts: VectorizeOptions,
  out: { outputPath?: string; outputDir?: string },
  withPreview: boolean,
): PreparedJob {
  if (process.platform !== 'win32') throw new Error('Vector Magic Desktop automation only runs on Windows.');
  const exe = resolveVectorMagicExe();
  if (!exe.path) {
    throw new Error(`Vector Magic (vmde.exe) not found. Tried: ${exe.tried.join(' ; ')}. Set VECTOR_MAGIC_EXE to the vmde.exe path.`);
  }
  if (!path.win32.isAbsolute(inputPath)) throw new Error(`input_path must be an absolute path: ${inputPath}`);
  if (!existsSync(inputPath) || !statSync(inputPath).isFile()) throw new Error(`Input image not found: ${inputPath}`);
  if (!isSupportedInput(inputPath)) {
    throw new Error(`Unsupported input format. Vector Magic reads: ${INPUT_EXTENSIONS.join(', ')}`);
  }
  const format = normalizeOutputFormat(opts.format);
  if (!format) throw new Error(`Unsupported output format "${opts.format}". Use one of: ${OUTPUT_FORMATS.join(', ')}`);
  const resolved = resolveOutputPath({ inputPath, ext: format, outputPath: out.outputPath, outputDir: out.outputDir, overwrite: opts.overwrite });
  if ('error' in resolved) throw new Error(resolved.error);

  return {
    format,
    params: {
      exePath: exe.path,
      inputPath,
      outputPath: resolved.path,
      format,
      shapeMode: SHAPE_MODES[opts.shape_mode],
      strokeMode: opts.stroke_shapes ? 0 : 1,
      dxfMode: DXF_MODES[opts.dxf_mode],
      bitmapScale: isBitmapFormat(format) ? opts.bitmap_scale : 1,
      detail: opts.detail,
      colors: opts.colors,
      overwrite: opts.overwrite,
      showWindow: opts.show_window,
      previewPath: withPreview ? path.join(os.tmpdir(), `vectormagic-preview-${randomUUID()}.png`) : undefined,
      debugDir: debugDir(),
      loadTimeoutSec: TIMEOUTS.loadSec,
      vectorizeTimeoutSec: TIMEOUTS.vectorizeSec,
      saveTimeoutSec: TIMEOUTS.saveSec,
    },
  };
}

export async function runJob(job: PreparedJob): Promise<EngineResult & { elapsedMs: number }> {
  await fs.mkdir(debugDir(), { recursive: true }).catch(() => undefined);
  const t0 = Date.now();
  const r = await runEngine(job.params);
  return { ...r, elapsedMs: Date.now() - t0 };
}

/** Public shape of a result (drops the internal log unless the run failed). */
export function publicResult(job: PreparedJob, r: EngineResult & { elapsedMs: number }, inputPath: string) {
  return {
    success: r.success,
    input_path: inputPath,
    output_path: r.success ? r.outputPath : undefined,
    format: job.format,
    bytes: r.bytes,
    vector_magic_summary: r.summary ?? undefined,
    elapsed_ms: r.elapsedMs,
    warnings: r.warnings && r.warnings.length > 0 ? r.warnings : undefined,
    error: r.error,
    debug_snapshot: r.success ? undefined : r.snapshot ?? undefined,
    log: r.success ? undefined : r.log,
  };
}
