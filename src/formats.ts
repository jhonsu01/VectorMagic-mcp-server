/**
 * Formats supported by Vector Magic Desktop Edition 1.15 (measured from the app's own dialogs).
 */

/** Import formats accepted by Vector Magic ("All Image Formats" filter of the open dialog). */
export const INPUT_EXTENSIONS = [
  'png', 'jpg', 'jpeg', 'bmp', 'tif', 'tiff', 'gif', 'psd', 'jp2', 'pcx',
  'ppm', 'pnm', 'pgm', 'pbm', 'tga', 'jng', 'mng', 'xpm',
] as const;

/** Editable vector formats written by "Quick save". */
export const VECTOR_FORMATS = ['svg', 'ai', 'eps', 'pdf', 'dxf', 'emf'] as const;

/** Bitmap formats written by "Export bitmap" (rendered from the vector result). */
export const BITMAP_FORMATS = ['png', 'jpg', 'bmp', 'tif'] as const;

export const OUTPUT_FORMATS = [...VECTOR_FORMATS, ...BITMAP_FORMATS] as const;

export type VectorFormat = (typeof VECTOR_FORMATS)[number];
export type BitmapFormat = (typeof BITMAP_FORMATS)[number];
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

/** Accepts common aliases (jpeg, tiff, upper case, leading dot). Returns undefined when unknown. */
export function normalizeOutputFormat(value: string): OutputFormat | undefined {
  const v = value.trim().toLowerCase().replace(/^\./, '');
  const alias: Record<string, string> = { jpeg: 'jpg', tiff: 'tif' };
  const f = alias[v] ?? v;
  return (OUTPUT_FORMATS as readonly string[]).includes(f) ? (f as OutputFormat) : undefined;
}

export function isBitmapFormat(f: OutputFormat): f is BitmapFormat {
  return (BITMAP_FORMATS as readonly string[]).includes(f);
}

export function isSupportedInput(filePath: string): boolean {
  const m = /\.([^.\\/]+)$/.exec(filePath);
  return !!m && (INPUT_EXTENSIONS as readonly string[]).includes(m[1].toLowerCase());
}

/** Export options as stored by Vector Magic (registry values of VmQt::MainModel). */
export const SHAPE_MODES = {
  /** Shapes are stacked on top of each other (easiest to edit, no gaps when moving shapes). */
  stacked: 0,
  /** Shapes are placed in cut-outs of the shapes below (no overlap). */
  adjoining: 1,
  /** Like adjoining, and shapes are grouped by colour. */
  adjoining_grouped: 2,
} as const;

export const DXF_MODES = {
  /** Lines and bicubic spline curves. */
  splines: 0,
  /** Lines only, curves flattened into few segments (smaller file). */
  few_lines: 1,
  /** Lines only, curves flattened into many segments (larger, smoother). */
  many_lines: 2,
} as const;

export type ShapeMode = keyof typeof SHAPE_MODES;
export type DxfMode = keyof typeof DXF_MODES;
