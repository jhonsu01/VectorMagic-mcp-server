<p align="center"><img src="icon.png" width="120" alt="Icono de Vector Magic Bridge"></p>

<h1 align="center">VectorMagic MCP Server</h1>

<p align="center">
  <a href="README.md">English</a> · <b>Español</b> · <a href="README.pt-BR.md">Português</a> · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a> · <a href="README.ja.md">日本語</a>
</p>

<p align="center">
  Deja que Claude vectorice cualquier imagen con el <b>Vector Magic Desktop Edition</b> instalado en tu PC con Windows —<br>
  PNG, JPG, GIF, PSD, TIFF… → <b>SVG, AI, EPS, PDF, DXF o EMF</b> editables.
</p>

---

## Por qué

Vector Magic Desktop Edition es uno de los mejores vectorizadores automáticos, pero **no tiene línea de comandos ni API**: solo un asistente gráfico. Este servidor [Model Context Protocol](https://modelcontextprotocol.io) maneja esa interfaz por ti, así que puedes pedirle a Claude cosas como:

> *«Vectoriza `D:\logos\cliente.png` como EPS con detalle bajo.»*
> *«Convierte todas las imágenes de `D:\escaneos` a SVG con colores ilimitados y déjalas en `D:\escaneos\vector`.»*

Está inspirado en [ie3jp/illustrator-mcp-server](https://github.com/ie3jp/illustrator-mcp-server); el resultado se abre directamente en Illustrator, Inkscape, CorelDRAW, AutoCAD, etc.

## Funciones

| | |
| --- | --- |
| **Entrada** | png, jpg, jpeg, bmp, tif, tiff, gif, psd, jp2, pcx, ppm, pnm, pgm, pbm, tga, jng, mng, xpm |
| **Salida vectorial** | svg, ai, eps, pdf, dxf, emf |
| **Salida de mapa de bits** | png, jpg, bmp, tif — renderizado desde el vector a 1×, 2× o 4× |
| **Opciones** | nivel de detalle, modo de color, disposición de formas, trazos, modo de curvas DXF |
| **Lotes** | una lista de archivos o una carpeta completa en una sola llamada |
| **Respuesta** | vista previa del resultado vectorial + lo que detectó Vector Magic (tipo de imagen, detalle, colores) |
| **Seguro** | nunca sobrescribe archivos, nunca toca las ventanas de Vector Magic que tengas abiertas, restaura tu configuración de Vector Magic después de cada uso, funciona sin conexión |

## Requisitos

- Windows 10/11
- **Vector Magic Desktop Edition** (probado con la **1.15**), con licencia y activado
- Node.js ≥ 20 (Claude Desktop lo incluye para las instalaciones `.mcpb`)

## Instalación

### Claude Desktop (recomendado)

1. Descarga `vectormagic-mcp-server.mcpb` de la [última release](https://github.com/jhonsu01/VectorMagic-mcp-server/releases/latest).
2. Haz doble clic (o arrástralo a Claude Desktop → *Configuración → Extensiones*) y pulsa **Instalar**.
3. Opcional: si Vector Magic no está en `C:\Program Files (x86)\Vector Magic`, indica la ruta de `vmde.exe` en la configuración de la extensión.

### Claude Code / otros clientes MCP

```bash
git clone https://github.com/jhonsu01/VectorMagic-mcp-server.git
cd VectorMagic-mcp-server
npm install
npm run build
claude mcp add vectormagic -- node "%CD%\dist\bundle.cjs"
```

Configuración MCP genérica:

```json
{
  "mcpServers": {
    "vectormagic": {
      "command": "node",
      "args": ["C:\\ruta\\a\\VectorMagic-mcp-server\\dist\\bundle.cjs"],
      "env": { "VECTOR_MAGIC_EXE": "C:\\Program Files (x86)\\Vector Magic\\vmde.exe" }
    }
  }
}
```

## Herramientas

### `vectorize_image`

| Parámetro | Por defecto | Descripción |
| --- | --- | --- |
| `input_path` | — | Ruta absoluta de la imagen |
| `output_path` | junto a la entrada | Ruta absoluta de salida; la extensión debe coincidir con `format` |
| `format` | `svg` | `svg` `ai` `eps` `pdf` `dxf` `emf` · mapa de bits: `png` `jpg` `bmp` `tif` |
| `detail` | `auto` | `auto` · `high` (alto) · `medium` (medio) · `low` (bajo) |
| `colors` | `auto` | `auto` (paleta reducida, logos) · `unlimited` (fotos, degradados) |
| `shape_mode` | `stacked` | `stacked` (apiladas, lo más fácil de editar) · `adjoining` (en recortes) · `adjoining_grouped` (agrupadas por color) |
| `stroke_shapes` | `false` | Contornear cada forma con un trazo de su color |
| `dxf_mode` | `splines` | `splines` · `few_lines` · `many_lines` (para CAD/CNC sin soporte de splines) |
| `bitmap_scale` | `1` | `1` · `2` · `4` (solo mapas de bits) |
| `overwrite` | `false` | Reemplazar un archivo de salida existente |
| `preview` | `true` | Devolver una vista previa PNG del resultado |
| `show_window` | `false` | Mantener visible la ventana de Vector Magic (depuración) |

Devuelve la ruta de salida, el tamaño, el tiempo empleado, un `vector_magic_summary` como `400x400 (0.2 megapixel) Básico: Ilustración suavizada, Medio, 6 colores` y la vista previa.

### `vectorize_batch`

Las mismas opciones, más `input_paths` (lista) **o** `input_dir` (no recursivo) y `output_dir`. Un resultado por imagen; un fallo no detiene el lote.

### `get_vector_magic_status`

Ruta de instalación, versión, ventanas de Vector Magic abiertas, formatos soportados y tiempos límite.

## Cómo funciona

```
Claude ──MCP──▶ servidor Node ──▶ motor PowerShell ──▶ Vector Magic (su propia ventana, fuera de pantalla)
                                    │ mensajes de ratón enviados a la ventana (tu cursor nunca se mueve)
                                    │ UI Automation (nombres de widgets) para saber en qué página del asistente está
                                    │ OCR de Windows sobre la barra de estado para confirmar los ajustes
                                    └ registro: opciones de exportación al entrar, tu configuración restaurada al salir
```

1. Copia la imagen a una carpeta temporal y respalda la configuración de Vector Magic (`HKCU\Software\Vector Magic`).
2. Escribe las opciones de exportación, abre un `vmde.exe` **nuevo** y mueve su ventana fuera de la pantalla.
3. Ejecuta **Totalmente Automático**, aplica el detalle y los colores pedidos en la página de revisión y usa **Guardado Rápido** (sin cuadros de diálogo).
4. Copia el resultado al destino, cierra su ventana de Vector Magic y restaura tu configuración.

Las conversiones van en cola, de una en una (Vector Magic guarda una única clave de configuración). Un logo típico tarda entre 10 y 20 s.

## Configuración

| Variable | Por defecto | |
| --- | --- | --- |
| `VECTOR_MAGIC_EXE` | `C:\Program Files (x86)\Vector Magic\vmde.exe` | Ruta de `vmde.exe` o de su carpeta |
| `VECTOR_MAGIC_LOAD_TIMEOUT` | `90` | Segundos para abrir la imagen |
| `VECTOR_MAGIC_VECTORIZE_TIMEOUT` | `300` | Segundos por pasada de vectorización |
| `VECTOR_MAGIC_SAVE_TIMEOUT` | `120` | Segundos para escribir el archivo |

## Solución de problemas

- **«Vector Magic (vmde.exe) not found»**: define `VECTOR_MAGIC_EXE` (o el ajuste de la extensión).
- **«Unexpected dialog»**: Vector Magic mostró un mensaje (activación, imagen muy grande…). El error incluye una captura `debug_snapshot` en `%TEMP%\vectormagic-mcp-debug`. Abre Vector Magic una vez a mano para resolverlo.
- **Tiempo agotado con fotos enormes**: sube `VECTOR_MAGIC_VECTORIZE_TIMEOUT`.
- El `vector_magic_summary` se lee por OCR y puede perder alguna letra (p. ej. `Medo`); es solo informativo.

## Limitaciones

- Solo Windows; probado con Vector Magic Desktop Edition 1.15 con la interfaz en español. La detección de páginas usa nombres de widgets y no depende del idioma; la verificación por OCR del nivel de detalle reconoce palabras en español, inglés, alemán, francés e italiano.
- Usa el flujo Totalmente Automático; los asistentes Básico/Avanzado y la edición manual de la segmentación no están automatizados (todavía).
- Una conversión a la vez.

## Privacidad

Todo se ejecuta en local. El servidor no hace peticiones de red ni envía telemetría. Las imágenes se copian a una carpeta temporal que se borra tras cada ejecución.

## Desarrollo

```bash
npm install
npm run build      # tsc + copia del motor PowerShell + bundle esbuild
npm test           # pruebas unitarias (no necesitan Vector Magic)
npm run test:e2e   # prueba MCP real de punta a punta (necesita Vector Magic)
npm run pack:mcpb  # genera vectormagic-mcp-server.mcpb
```

El motor PowerShell (`src/ps/`) debe ser ASCII puro: Windows PowerShell 5.1 lee los scripts sin BOM en la página de códigos ANSI (una prueba unitaria lo verifica).

## Licencia

[MIT](LICENSE). Vector Magic es una marca de Vector Magic, Inc. Este proyecto no está afiliado ni respaldado por Vector Magic, Inc.; necesitas tu propia copia con licencia de Vector Magic Desktop Edition.
