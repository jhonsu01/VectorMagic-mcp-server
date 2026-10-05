<p align="center"><img src="icon.png" width="120" alt="Vector Magic Bridge icon"></p>

<h1 align="center">VectorMagic MCP Server</h1>

<p align="center">
  <b>English</b> · <a href="README.es.md">Español</a> · <a href="README.pt-BR.md">Português</a> · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a> · <a href="README.ja.md">日本語</a>
</p>

<p align="center">
  Let Claude vectorize any bitmap with the <b>Vector Magic Desktop Edition</b> installed on your Windows PC —<br>
  PNG, JPG, GIF, PSD, TIFF… → editable <b>SVG, AI, EPS, PDF, DXF or EMF</b>.
</p>

---

## Why

Vector Magic Desktop Edition is one of the best automatic tracers, but it has **no command line and no API** — only a wizard GUI. This [Model Context Protocol](https://modelcontextprotocol.io) server drives that GUI for you, so you can ask Claude things like:

> *"Vectorize `D:\logos\client.png` as an EPS with low detail."*
> *"Convert every image in `D:\scans` to SVG with unlimited colours and put them in `D:\scans\vector`."*

It was inspired by [ie3jp/illustrator-mcp-server](https://github.com/ie3jp/illustrator-mcp-server); the result opens directly in Illustrator, Inkscape, CorelDRAW, AutoCAD, etc.

## Features

| | |
| --- | --- |
| **Input** | png, jpg, jpeg, bmp, tif, tiff, gif, psd, jp2, pcx, ppm, pnm, pgm, pbm, tga, jng, mng, xpm |
| **Vector output** | svg, ai, eps, pdf, dxf, emf |
| **Bitmap output** | png, jpg, bmp, tif — re-rendered from the vector result at 1×, 2× or 4× |
| **Options** | level of detail, colour mode, shape layering, strokes, DXF curve mode |
| **Batch** | a list of files or a whole folder in one call |
| **Feedback** | a preview image of the vector result + what Vector Magic detected (image type, detail, colours) |
| **Safe** | never overwrites files, never touches Vector Magic windows you have open, restores your Vector Magic settings after every run, works offline |

## Requirements

- Windows 10/11
- **Vector Magic Desktop Edition** (tested with **1.15**), licensed and activated
- Node.js ≥ 20 (bundled with Claude Desktop for `.mcpb` installs)

## Installation

### Claude Desktop (recommended)

1. Download `vectormagic-mcp-server.mcpb` from the [latest release](https://github.com/jhonsu01/VectorMagic-mcp-server/releases/latest).
2. Double-click it (or drag it onto Claude Desktop → *Settings → Extensions*) and click **Install**.
3. Optional: if Vector Magic is not in `C:\Program Files (x86)\Vector Magic`, set the path to `vmde.exe` in the extension settings.

### Claude Code / other MCP clients

```bash
git clone https://github.com/jhonsu01/VectorMagic-mcp-server.git
cd VectorMagic-mcp-server
npm install
npm run build
claude mcp add vectormagic -- node "%CD%\dist\bundle.cjs"
```

Generic MCP config:

```json
{
  "mcpServers": {
    "vectormagic": {
      "command": "node",
      "args": ["C:\\path\\to\\VectorMagic-mcp-server\\dist\\bundle.cjs"],
      "env": { "VECTOR_MAGIC_EXE": "C:\\Program Files (x86)\\Vector Magic\\vmde.exe" }
    }
  }
}
```

## Tools

### `vectorize_image`

| Parameter | Default | Description |
| --- | --- | --- |
| `input_path` | — | Absolute path of the image |
| `output_path` | next to the input | Absolute output path; the extension must match `format` |
| `format` | `svg` | `svg` `ai` `eps` `pdf` `dxf` `emf` · bitmap: `png` `jpg` `bmp` `tif` |
| `detail` | `auto` | `auto` · `high` · `medium` · `low` |
| `colors` | `auto` | `auto` (reduced palette, logos) · `unlimited` (photos, gradients) |
| `shape_mode` | `stacked` | `stacked` (easiest to edit) · `adjoining` · `adjoining_grouped` (grouped by colour) |
| `stroke_shapes` | `false` | Outline each shape with a stroke of its colour |
| `dxf_mode` | `splines` | `splines` · `few_lines` · `many_lines` (for CAD/CNC without spline support) |
| `bitmap_scale` | `1` | `1` · `2` · `4` (bitmap formats only) |
| `overwrite` | `false` | Replace an existing output file |
| `preview` | `true` | Return a PNG preview of the result |
| `show_window` | `false` | Keep the Vector Magic window on screen (debugging) |

Returns the output path, size, elapsed time, a `vector_magic_summary` such as `400x400 (0.2 megapixel) Basic: Smooth artwork, Medium, 6 colors`, and the preview.

### `vectorize_batch`

Same options, plus `input_paths` (list) **or** `input_dir` (non-recursive), and `output_dir`. One result per image; a failure does not stop the batch.

### `get_vector_magic_status`

Installation path, version, open Vector Magic windows, supported formats and timeouts.

## How it works

```
Claude ──MCP──▶ Node server ──▶ PowerShell engine ──▶ Vector Magic (its own window, off-screen)
                                  │ posted mouse messages (your cursor is never moved)
                                  │ UI Automation (widget names) to know which wizard page is open
                                  │ Windows OCR of the status bar to confirm the settings
                                  └ registry: export options in, your settings restored afterwards
```

1. Copies the image to a temporary folder and backs up Vector Magic's settings (`HKCU\Software\Vector Magic`).
2. Writes the export options, starts a **new** `vmde.exe` and moves its window off-screen.
3. Runs **Fully Automatic**, applies the requested detail / colours on the review page, and uses **Quick Save** (no file dialogs).
4. Copies the result to the destination, closes its Vector Magic window and restores your settings.

Runs are queued one at a time (Vector Magic keeps a single settings key). A typical logo takes 10–20 s.

## Configuration

| Variable | Default | |
| --- | --- | --- |
| `VECTOR_MAGIC_EXE` | `C:\Program Files (x86)\Vector Magic\vmde.exe` | Path to `vmde.exe` or to its folder |
| `VECTOR_MAGIC_LOAD_TIMEOUT` | `90` | Seconds to open the image |
| `VECTOR_MAGIC_VECTORIZE_TIMEOUT` | `300` | Seconds per vectorization pass |
| `VECTOR_MAGIC_SAVE_TIMEOUT` | `120` | Seconds to write the file |

## Troubleshooting

- **"Vector Magic (vmde.exe) not found"** — set `VECTOR_MAGIC_EXE` (or the extension setting).
- **"Unexpected dialog"** — Vector Magic showed a message (activation, very large image…). The error includes a `debug_snapshot` PNG in `%TEMP%\vectormagic-mcp-debug`. Open Vector Magic once by hand to clear it.
- **Timeouts with huge photos** — raise `VECTOR_MAGIC_VECTORIZE_TIMEOUT`.
- The `vector_magic_summary` is read by OCR and may miss a letter (e.g. `Medo`); it is informative only.

## Limitations

- Windows only; tested with Vector Magic Desktop Edition 1.15 with the Spanish UI. Page detection uses widget names and is language-independent; the OCR check of the detail level knows Spanish, English, German, French and Italian words.
- Uses the Fully Automatic pipeline; the Basic/Advanced wizards and manual segmentation editing are not automated (yet).
- One conversion at a time.

## Privacy

Everything runs locally. The server makes no network requests and sends no telemetry. Images are copied to a temporary folder that is deleted after each run.

## Development

```bash
npm install
npm run build      # tsc + copy PowerShell engine + esbuild bundle
npm test           # unit tests (no Vector Magic needed)
npm run test:e2e   # real MCP end-to-end test (needs Vector Magic)
npm run pack:mcpb  # builds vectormagic-mcp-server.mcpb
```

The PowerShell engine (`src/ps/`) must stay pure ASCII: Windows PowerShell 5.1 reads BOM-less scripts in the ANSI code page (a unit test enforces it).

## License

[MIT](LICENSE). Vector Magic is a trademark of Vector Magic, Inc. This project is not affiliated with or endorsed by Vector Magic, Inc. — you need your own licensed copy of Vector Magic Desktop Edition.
