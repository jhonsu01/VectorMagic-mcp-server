# Changelog

All notable changes follow [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-10-05

### Added
- `vectorize_image`: vectorizes one image with Vector Magic Desktop Edition (Fully Automatic) and exports
  SVG, AI, EPS, PDF, DXF or EMF, or re-renders PNG/JPG/BMP/TIF at 1x/2x/4x. Returns a preview image and
  the summary Vector Magic shows (image type, detail level, colours).
- Options: `detail` (auto/high/medium/low), `colors` (auto/unlimited), `shape_mode`
  (stacked/adjoining/adjoining_grouped), `stroke_shapes`, `dxf_mode` (splines/few_lines/many_lines),
  `bitmap_scale`, `overwrite`, `show_window`.
- `vectorize_batch`: a list of images or a whole folder, one result per image.
- `get_vector_magic_status`: installation, version, open windows, supported formats.
- PowerShell automation engine: posted mouse messages (cursor never moves), page detection through
  UI Automation widget names, settings confirmed by Windows OCR of the status bar, off-screen window,
  Vector Magic settings backed up and restored on every run, never touches user-opened Vector Magic windows.
- `.mcpb` package for Claude Desktop; README in English, Spanish, Portuguese, French, German and Japanese.
