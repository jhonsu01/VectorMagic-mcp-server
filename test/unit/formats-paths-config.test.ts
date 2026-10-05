import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { normalizeOutputFormat, isSupportedInput, isBitmapFormat, SHAPE_MODES, DXF_MODES } from '../../src/formats.js';
import { resolveOutputPath } from '../../src/paths.js';
import { resolveVectorMagicExe, resolveSeconds } from '../../src/config.js';
import { engineTimeoutMs } from '../../src/executor/ps-runner.js';

describe('formats', () => {
  it('normalizes aliases and rejects unknown formats', () => {
    expect(normalizeOutputFormat('SVG')).toBe('svg');
    expect(normalizeOutputFormat('.jpeg')).toBe('jpg');
    expect(normalizeOutputFormat('tiff')).toBe('tif');
    expect(normalizeOutputFormat('webp')).toBeUndefined();
  });
  it('recognizes input images case-insensitively', () => {
    expect(isSupportedInput('C:\\a\\Logo.PNG')).toBe(true);
    expect(isSupportedInput('C:\\a\\scan.psd')).toBe(true);
    expect(isSupportedInput('C:\\a\\doc.pdf')).toBe(false);
    expect(isSupportedInput('C:\\a\\noext')).toBe(false);
  });
  it('separates bitmap from vector outputs', () => {
    expect(isBitmapFormat('png')).toBe(true);
    expect(isBitmapFormat('svg')).toBe(false);
  });
  it('keeps the registry values measured on Vector Magic 1.15', () => {
    expect(SHAPE_MODES).toEqual({ stacked: 0, adjoining: 1, adjoining_grouped: 2 });
    expect(DXF_MODES).toEqual({ splines: 0, few_lines: 1, many_lines: 2 });
  });
});

describe('resolveOutputPath', () => {
  const none = () => false;
  it('defaults next to the input with the new extension', () => {
    expect(resolveOutputPath({ inputPath: 'D:\\img\\logo.png', ext: 'svg', exists: none })).toEqual({ path: 'D:\\img\\logo.svg' });
  });
  it('never overwrites by default: adds _2, _3', () => {
    const taken = new Set(['D:\\img\\logo.svg', 'D:\\img\\logo_2.svg']);
    expect(resolveOutputPath({ inputPath: 'D:\\img\\logo.png', ext: 'svg', exists: (p) => taken.has(p) })).toEqual({ path: 'D:\\img\\logo_3.svg' });
  });
  it('uses output_dir when given', () => {
    expect(resolveOutputPath({ inputPath: 'D:\\img\\logo.png', ext: 'ai', outputDir: 'E:\\out', exists: none })).toEqual({ path: 'E:\\out\\logo.ai' });
  });
  it('appends a missing extension and rejects a mismatched one', () => {
    expect(resolveOutputPath({ inputPath: 'D:\\a.png', ext: 'eps', outputPath: 'D:\\out\\x', exists: none })).toEqual({ path: 'D:\\out\\x.eps' });
    expect(resolveOutputPath({ inputPath: 'D:\\a.png', ext: 'eps', outputPath: 'D:\\out\\x.svg', exists: none })).toHaveProperty('error');
    expect(resolveOutputPath({ inputPath: 'D:\\a.png', ext: 'jpg', outputPath: 'D:\\out\\x.jpeg', exists: none })).toEqual({ path: 'D:\\out\\x.jpeg' });
  });
  it('requires absolute paths and refuses to replace files without overwrite', () => {
    expect(resolveOutputPath({ inputPath: 'D:\\a.png', ext: 'svg', outputPath: 'out.svg', exists: none })).toHaveProperty('error');
    expect(resolveOutputPath({ inputPath: 'D:\\a.png', ext: 'svg', outputPath: 'D:\\o.svg', exists: () => true })).toHaveProperty('error');
    expect(resolveOutputPath({ inputPath: 'D:\\a.png', ext: 'svg', outputPath: 'D:\\o.svg', overwrite: true, exists: () => true })).toEqual({ path: 'D:\\o.svg' });
  });
});

describe('config', () => {
  it('prefers VECTOR_MAGIC_EXE, accepting a folder', () => {
    const r = resolveVectorMagicExe('E:\\Apps\\Vector Magic', (p) => p === 'E:\\Apps\\Vector Magic\\vmde.exe');
    expect(r).toMatchObject({ path: 'E:\\Apps\\Vector Magic\\vmde.exe', source: 'env' });
  });
  it('ignores an unfilled MCPB placeholder and falls back to defaults', () => {
    const r = resolveVectorMagicExe('${user_config.vector_magic_exe}', (p) => p === 'C:\\Program Files (x86)\\Vector Magic\\vmde.exe');
    expect(r.source).toBe('default');
  });
  it('reports not-found with the paths it tried', () => {
    const r = resolveVectorMagicExe(undefined, () => false);
    expect(r.path).toBeUndefined();
    expect(r.tried.length).toBeGreaterThanOrEqual(2);
  });
  it('parses timeouts defensively', () => {
    expect(resolveSeconds('45', 10)).toBe(45);
    expect(resolveSeconds('abc', 10)).toBe(10);
    expect(resolveSeconds('0', 10)).toBe(10);
    expect(engineTimeoutMs({ loadTimeoutSec: 10, vectorizeTimeoutSec: 20, saveTimeoutSec: 5 })).toBe((10 + 60 + 5 + 45) * 1000);
  });
});

describe('PowerShell engine', () => {
  it('is pure ASCII (Windows PowerShell 5.1 reads BOM-less scripts as ANSI)', () => {
    for (const f of readdirSync('src/ps')) {
      const buf = readFileSync(`src/ps/${f}`);
      expect(buf.findIndex((b) => b > 0x7f), f).toBe(-1);
    }
  });
  it('never redirects native stderr with 2>&1 under ErrorAction Stop', () => {
    for (const f of readdirSync('src/ps')) {
      expect(readFileSync(`src/ps/${f}`, 'utf-8')).not.toMatch(/&\s*reg\.exe[^\n]*2>&1/);
    }
  });
});

describe('manifest', () => {
  it('stays in sync with package.json and declares every tool', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
    const manifest = JSON.parse(readFileSync('manifest.json', 'utf-8'));
    expect(manifest.version).toBe(pkg.version);
    expect(manifest.tools.map((t: { name: string }) => t.name).sort()).toEqual(['get_vector_magic_status', 'vectorize_batch', 'vectorize_image']);
    expect(manifest.compatibility.platforms).toEqual(['win32']);
  });
});
