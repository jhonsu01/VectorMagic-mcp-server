import { existsSync } from 'fs';
import * as path from 'path';

/**
 * Output path rules:
 *  - explicit path: must be absolute; the extension is added when missing and must match the format;
 *    an existing file is only replaced with overwrite=true.
 *  - no path: next to the input (or in outputDir) as <input name>.<ext>, adding _2, _3... instead of
 *    replacing anything.
 */
export function resolveOutputPath(opts: {
  inputPath: string;
  ext: string;
  outputPath?: string;
  outputDir?: string;
  overwrite?: boolean;
  exists?: (p: string) => boolean;
}): { path: string } | { error: string } {
  const exists = opts.exists ?? existsSync;
  const p = path.win32;
  if (opts.outputPath) {
    if (!p.isAbsolute(opts.outputPath)) return { error: `output_path must be an absolute path: ${opts.outputPath}` };
    const base = p.basename(opts.outputPath);
    const dot = base.lastIndexOf('.');
    let out = opts.outputPath;
    if (dot <= 0) out = `${opts.outputPath}.${opts.ext}`;
    else {
      const cur = base.substring(dot + 1).toLowerCase();
      const same = cur === opts.ext || (opts.ext === 'jpg' && cur === 'jpeg') || (opts.ext === 'tif' && cur === 'tiff');
      if (!same) return { error: `output_path has extension ".${cur}" but the format is "${opts.ext}".` };
    }
    if (exists(out) && !opts.overwrite) return { error: `File already exists (set overwrite: true to replace it): ${out}` };
    return { path: out };
  }
  const dir = opts.outputDir ?? p.dirname(opts.inputPath);
  if (!p.isAbsolute(dir)) return { error: `output_dir must be an absolute path: ${dir}` };
  const stem = p.basename(opts.inputPath).replace(/\.[^.]+$/, '');
  let candidate = p.join(dir, `${stem}.${opts.ext}`);
  for (let i = 2; exists(candidate) && !opts.overwrite; i++) {
    candidate = p.join(dir, `${stem}_${i}.${opts.ext}`);
  }
  return { path: candidate };
}
