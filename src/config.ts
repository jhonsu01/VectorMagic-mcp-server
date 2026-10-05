import { existsSync } from 'fs';
import * as path from 'path';

/** Default install locations of Vector Magic Desktop Edition. */
export const DEFAULT_EXE_CANDIDATES = [
  'C:\\Program Files (x86)\\Vector Magic\\vmde.exe',
  'C:\\Program Files\\Vector Magic\\vmde.exe',
];

/**
 * An unfilled MCPB user_config placeholder ("${user_config.x}") reaches the process
 * literally when the user left the field empty, so treat it as unset.
 */
function cleanEnv(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.trim().replace(/^"(.*)"$/, '$1');
  if (!v || v.includes('${')) return undefined;
  return v;
}

export interface ExeResolution {
  path: string | undefined;
  source: 'env' | 'default' | 'not-found';
  tried: string[];
}

/**
 * VECTOR_MAGIC_EXE may point at vmde.exe or at the install folder.
 */
export function resolveVectorMagicExe(
  envValue: string | undefined = process.env['VECTOR_MAGIC_EXE'],
  exists: (p: string) => boolean = existsSync,
): ExeResolution {
  const tried: string[] = [];
  const fromEnv = cleanEnv(envValue);
  if (fromEnv) {
    const candidate = /\.exe$/i.test(fromEnv) ? fromEnv : path.win32.join(fromEnv, 'vmde.exe');
    tried.push(candidate);
    if (exists(candidate)) return { path: candidate, source: 'env', tried };
  }
  for (const c of DEFAULT_EXE_CANDIDATES) {
    tried.push(c);
    if (exists(c)) return { path: c, source: 'default', tried };
  }
  return { path: undefined, source: 'not-found', tried };
}

/** Positive integer seconds from an env var, otherwise the default. */
export function resolveSeconds(envValue: string | undefined, def: number): number {
  if (!envValue || !/^\d+$/.test(envValue.trim())) return def;
  const n = Number(envValue.trim());
  return n > 0 && n <= 3600 ? n : def;
}

export const TIMEOUTS = {
  /** Image load until the main window appears. */
  loadSec: resolveSeconds(process.env['VECTOR_MAGIC_LOAD_TIMEOUT'], 90),
  /** One vectorization pass (large photos can take minutes). */
  vectorizeSec: resolveSeconds(process.env['VECTOR_MAGIC_VECTORIZE_TIMEOUT'], 300),
  /** Writing the export file. */
  saveSec: resolveSeconds(process.env['VECTOR_MAGIC_SAVE_TIMEOUT'], 120),
};
