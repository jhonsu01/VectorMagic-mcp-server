<p align="center"><img src="icon.png" width="120" alt="Vector Magic Bridge Symbol"></p>

<h1 align="center">VectorMagic MCP Server</h1>

<p align="center">
  <a href="README.md">English</a> · <a href="README.es.md">Español</a> · <a href="README.pt-BR.md">Português</a> · <a href="README.fr.md">Français</a> · <b>Deutsch</b> · <a href="README.ja.md">日本語</a>
</p>

<p align="center">
  Lassen Sie Claude jedes Bild mit der auf Ihrem Windows-PC installierten <b>Vector Magic Desktop Edition</b> vektorisieren —<br>
  PNG, JPG, GIF, PSD, TIFF… → bearbeitbares <b>SVG, AI, EPS, PDF, DXF oder EMF</b>.
</p>

---

## Warum

Vector Magic Desktop Edition gehört zu den besten automatischen Vektorisierern, hat aber **weder Kommandozeile noch API** — nur einen grafischen Assistenten. Dieser [Model Context Protocol](https://modelcontextprotocol.io)-Server steuert diese Oberfläche für Sie, sodass Sie Claude zum Beispiel bitten können:

> *„Vektorisiere `D:\logos\kunde.png` als EPS mit niedrigem Detailgrad.“*
> *„Wandle alle Bilder in `D:\scans` mit unbegrenzten Farben in SVG um und lege sie in `D:\scans\vector` ab.“*

Inspiriert von [ie3jp/illustrator-mcp-server](https://github.com/ie3jp/illustrator-mcp-server); das Ergebnis öffnet sich direkt in Illustrator, Inkscape, CorelDRAW, AutoCAD usw.

## Funktionen

| | |
| --- | --- |
| **Eingabe** | png, jpg, jpeg, bmp, tif, tiff, gif, psd, jp2, pcx, ppm, pnm, pgm, pbm, tga, jng, mng, xpm |
| **Vektorausgabe** | svg, ai, eps, pdf, dxf, emf |
| **Bitmapausgabe** | png, jpg, bmp, tif — aus dem Vektor gerendert mit 1×, 2× oder 4× |
| **Optionen** | Detailgrad, Farbmodus, Formanordnung, Konturen, DXF-Kurvenmodus |
| **Stapel** | eine Dateiliste oder ein ganzer Ordner in einem Aufruf |
| **Rückmeldung** | Vorschaubild des Vektorergebnisses + was Vector Magic erkannt hat (Bildtyp, Detail, Farben) |
| **Sicher** | überschreibt nie Dateien, rührt Ihre geöffneten Vector-Magic-Fenster nie an, stellt Ihre Vector-Magic-Einstellungen nach jedem Lauf wieder her, funktioniert offline |

## Voraussetzungen

- Windows 10/11
- **Vector Magic Desktop Edition** (getestet mit **1.15**), lizenziert und aktiviert
- Node.js ≥ 20 (bei `.mcpb`-Installationen in Claude Desktop enthalten)

## Installation

### Claude Desktop (empfohlen)

1. `vectormagic-mcp-server.mcpb` aus dem [neuesten Release](https://github.com/jhonsu01/VectorMagic-mcp-server/releases/latest) herunterladen.
2. Doppelklicken (oder in Claude Desktop → *Einstellungen → Erweiterungen* ziehen) und **Installieren** klicken.
3. Optional: Liegt Vector Magic nicht in `C:\Program Files (x86)\Vector Magic`, den Pfad zu `vmde.exe` in den Erweiterungseinstellungen angeben.

### Claude Code / andere MCP-Clients

```bash
git clone https://github.com/jhonsu01/VectorMagic-mcp-server.git
cd VectorMagic-mcp-server
npm install
npm run build
claude mcp add vectormagic -- node "%CD%\dist\bundle.cjs"
```

## Werkzeuge

### `vectorize_image`

| Parameter | Standard | Beschreibung |
| --- | --- | --- |
| `input_path` | — | Absoluter Pfad des Bildes |
| `output_path` | neben der Eingabe | Absoluter Ausgabepfad; die Endung muss zu `format` passen |
| `format` | `svg` | `svg` `ai` `eps` `pdf` `dxf` `emf` · Bitmap: `png` `jpg` `bmp` `tif` |
| `detail` | `auto` | `auto` · `high` · `medium` · `low` |
| `colors` | `auto` | `auto` (reduzierte Palette, Logos) · `unlimited` (Fotos, Verläufe) |
| `shape_mode` | `stacked` | `stacked` (gestapelt, am leichtesten zu bearbeiten) · `adjoining` · `adjoining_grouped` (nach Farbe gruppiert) |
| `stroke_shapes` | `false` | Jede Form mit einer Kontur in ihrer Farbe versehen |
| `dxf_mode` | `splines` | `splines` · `few_lines` · `many_lines` (CAD/CNC ohne Spline-Unterstützung) |
| `bitmap_scale` | `1` | `1` · `2` · `4` (nur Bitmap) |
| `overwrite` | `false` | Vorhandene Datei ersetzen |
| `preview` | `true` | PNG-Vorschau zurückgeben |
| `show_window` | `false` | Vector-Magic-Fenster sichtbar lassen (Debugging) |

### `vectorize_batch`

Gleiche Optionen plus `input_paths` (Liste) **oder** `input_dir` (nicht rekursiv) und `output_dir`. Ein Ergebnis pro Bild; ein Fehler stoppt den Stapel nicht.

### `get_vector_magic_status`

Installationspfad, Version, geöffnete Vector-Magic-Fenster, unterstützte Formate und Zeitlimits.

## Funktionsweise

1. Kopiert das Bild in einen temporären Ordner und sichert die Vector-Magic-Einstellungen (`HKCU\Software\Vector Magic`).
2. Schreibt die Exportoptionen, startet eine **neue** `vmde.exe` und verschiebt ihr Fenster aus dem Bildschirm.
3. Führt **Vollautomatisch** aus, setzt Detail/Farben auf der Prüfseite und nutzt **Schnellspeichern** (keine Dialoge).
4. Kopiert das Ergebnis ans Ziel, schließt sein Fenster und stellt Ihre Einstellungen wieder her.

Klicks sind an das Fenster gesendete Nachrichten (Ihr Mauszeiger bewegt sich nie); die Assistentenseite wird über Widget-Namen (UI Automation) erkannt, die Einstellungen werden per Windows-OCR in der Statusleiste bestätigt. Eine Konvertierung gleichzeitig; ein typisches Logo dauert 10–20 s.

## Konfiguration

| Variable | Standard | |
| --- | --- | --- |
| `VECTOR_MAGIC_EXE` | `C:\Program Files (x86)\Vector Magic\vmde.exe` | Pfad zu `vmde.exe` oder zum Ordner |
| `VECTOR_MAGIC_LOAD_TIMEOUT` | `90` | Sekunden zum Öffnen des Bildes |
| `VECTOR_MAGIC_VECTORIZE_TIMEOUT` | `300` | Sekunden pro Vektorisierungsdurchlauf |
| `VECTOR_MAGIC_SAVE_TIMEOUT` | `120` | Sekunden zum Schreiben der Datei |

## Einschränkungen

- Nur Windows; getestet mit Vector Magic Desktop Edition 1.15 mit spanischer Oberfläche. Die Seitenerkennung nutzt Widget-Namen und ist sprachunabhängig.
- Nutzt den vollautomatischen Ablauf; Basis-/Erweitert-Assistenten und manuelle Bearbeitung sind (noch) nicht automatisiert.
- Die `vector_magic_summary` wird per OCR gelesen und kann einen Buchstaben auslassen; sie dient nur zur Information.

## Datenschutz

Alles läuft lokal, ohne Netzwerkanfragen oder Telemetrie. Bilder werden in einen temporären Ordner kopiert, der nach jedem Lauf gelöscht wird.

## Lizenz

[MIT](LICENSE). Vector Magic ist eine Marke von Vector Magic, Inc. Dieses Projekt ist weder mit Vector Magic, Inc. verbunden noch von ihr unterstützt — Sie benötigen eine eigene lizenzierte Kopie der Vector Magic Desktop Edition.
