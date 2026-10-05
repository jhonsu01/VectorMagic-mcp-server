import { execFile } from 'child_process';
import { existsSync } from 'fs';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

/**
 * Runs the PowerShell engine (src/ps/vm-engine.ps1) that drives Vector Magic's GUI.
 * Parameters and results travel through JSON files, like the Illustrator connector's JSX runner.
 */

export interface EngineParams {
  exePath: string;
  inputPath: string;
  outputPath: string;
  format: string;
  shapeMode: number;
  strokeMode: number;
  dxfMode: number;
  bitmapScale: number;
  detail: 'auto' | 'high' | 'medium' | 'low';
  colors: 'auto' | 'unlimited';
  overwrite: boolean;
  showWindow: boolean;
  previewPath?: string;
  debugDir?: string;
  loadTimeoutSec: number;
  vectorizeTimeoutSec: number;
  saveTimeoutSec: number;
}

export interface EngineResult {
  success: boolean;
  error?: string;
  outputPath?: string;
  bytes?: number;
  summary?: string | null;
  previewPath?: string | null;
  snapshot?: string | null;
  warnings?: string[];
  pid?: number;
  log?: string[];
}

// ESM (dist/executor/ps-runner.js) -> ../ps ; CJS bundle (dist/bundle.cjs) -> ./ps
const here = path.dirname(fileURLToPath(import.meta.url));
const candidates = [path.resolve(here, '../ps/vm-engine.ps1'), path.resolve(here, 'ps/vm-engine.ps1')];
export const ENGINE_PATH = candidates.find((p) => existsSync(p)) ?? candidates[0];

// Vector Magic shares one settings key in the registry, so runs must never overlap.
let queue: Promise<unknown> = Promise.resolve();
let pending = 0;
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  pending++;
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run.finally(() => { pending--; });
}
export function pendingRuns(): number {
  return pending;
}

export function engineTimeoutMs(p: Pick<EngineParams, 'loadTimeoutSec' | 'vectorizeTimeoutSec' | 'saveTimeoutSec'>): number {
  // load + up to 3 vectorization passes (auto, detail, colours) + save + start/close margin
  return (p.loadTimeoutSec + p.vectorizeTimeoutSec * 3 + p.saveTimeoutSec + 45) * 1000;
}

export function runEngine(params: EngineParams): Promise<EngineResult> {
  return serialize(async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vectormagic-mcp-'));
    const paramsPath = path.join(dir, `params-${randomUUID()}.json`);
    const resultPath = path.join(dir, `result-${randomUUID()}.json`);
    try {
      await fs.writeFile(paramsPath, JSON.stringify(params), 'utf-8');
      const timeout = engineTimeoutMs(params);
      const stderr = await new Promise<string>((resolve) => {
        execFile(
          'powershell.exe',
          ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', ENGINE_PATH,
            '-ParamsPath', paramsPath, '-ResultPath', resultPath],
          { timeout, windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
          (error, _stdout, err) => resolve(error ? `${err || ''}${error.killed ? ` (engine killed after ${timeout} ms)` : ''}`.trim() || error.message : ''),
        );
      });
      let raw: string;
      try {
        raw = await fs.readFile(resultPath, 'utf-8');
      } catch {
        return { success: false, error: `The automation engine produced no result. ${stderr}`.trim() };
      }
      return JSON.parse(raw.replace(/^﻿/, '')) as EngineResult;
    } finally {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  });
}
