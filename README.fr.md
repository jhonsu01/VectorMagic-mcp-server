<p align="center"><img src="icon.png" width="120" alt="Icône de Vector Magic Bridge"></p>

<h1 align="center">VectorMagic MCP Server</h1>

<p align="center">
  <a href="README.md">English</a> · <a href="README.es.md">Español</a> · <a href="README.pt-BR.md">Português</a> · <b>Français</b> · <a href="README.de.md">Deutsch</a> · <a href="README.ja.md">日本語</a>
</p>

<p align="center">
  Laissez Claude vectoriser n'importe quelle image avec le <b>Vector Magic Desktop Edition</b> installé sur votre PC Windows —<br>
  PNG, JPG, GIF, PSD, TIFF… → <b>SVG, AI, EPS, PDF, DXF ou EMF</b> modifiables.
</p>

---

## Pourquoi

Vector Magic Desktop Edition est l'un des meilleurs vectoriseurs automatiques, mais il **n'a ni ligne de commande ni API** — seulement un assistant graphique. Ce serveur [Model Context Protocol](https://modelcontextprotocol.io) pilote cette interface pour vous ; vous pouvez demander à Claude :

> *« Vectorise `D:\logos\client.png` en EPS avec un niveau de détail bas. »*
> *« Convertis toutes les images de `D:\scans` en SVG avec couleurs illimitées dans `D:\scans\vector`. »*

Inspiré de [ie3jp/illustrator-mcp-server](https://github.com/ie3jp/illustrator-mcp-server) ; le résultat s'ouvre directement dans Illustrator, Inkscape, CorelDRAW, AutoCAD, etc.

## Fonctionnalités

| | |
| --- | --- |
| **Entrée** | png, jpg, jpeg, bmp, tif, tiff, gif, psd, jp2, pcx, ppm, pnm, pgm, pbm, tga, jng, mng, xpm |
| **Sortie vectorielle** | svg, ai, eps, pdf, dxf, emf |
| **Sortie bitmap** | png, jpg, bmp, tif — rendue depuis le vecteur à 1×, 2× ou 4× |
| **Options** | niveau de détail, mode couleur, disposition des formes, contours, mode des courbes DXF |
| **Lot** | une liste de fichiers ou un dossier entier en un appel |
| **Retour** | aperçu du résultat vectoriel + ce que Vector Magic a détecté (type d'image, détail, couleurs) |
| **Sûr** | n'écrase jamais de fichier, ne touche jamais aux fenêtres Vector Magic que vous avez ouvertes, restaure vos réglages Vector Magic après chaque exécution, fonctionne hors ligne |

## Prérequis

- Windows 10/11
- **Vector Magic Desktop Edition** (testé avec la **1.15**), sous licence et activé
- Node.js ≥ 20 (fourni par Claude Desktop pour les installations `.mcpb`)

## Installation

### Claude Desktop (recommandé)

1. Téléchargez `vectormagic-mcp-server.mcpb` depuis la [dernière release](https://github.com/jhonsu01/VectorMagic-mcp-server/releases/latest).
2. Double-cliquez dessus (ou glissez-le dans Claude Desktop → *Paramètres → Extensions*) puis cliquez sur **Installer**.
3. Facultatif : si Vector Magic n'est pas dans `C:\Program Files (x86)\Vector Magic`, indiquez le chemin de `vmde.exe` dans les réglages de l'extension.

### Claude Code / autres clients MCP

```bash
git clone https://github.com/jhonsu01/VectorMagic-mcp-server.git
cd VectorMagic-mcp-server
npm install
npm run build
claude mcp add vectormagic -- node "%CD%\dist\bundle.cjs"
```

## Outils

### `vectorize_image`

| Paramètre | Défaut | Description |
| --- | --- | --- |
| `input_path` | — | Chemin absolu de l'image |
| `output_path` | à côté de l'entrée | Chemin absolu de sortie ; l'extension doit correspondre à `format` |
| `format` | `svg` | `svg` `ai` `eps` `pdf` `dxf` `emf` · bitmap : `png` `jpg` `bmp` `tif` |
| `detail` | `auto` | `auto` · `high` · `medium` · `low` |
| `colors` | `auto` | `auto` (palette réduite, logos) · `unlimited` (photos, dégradés) |
| `shape_mode` | `stacked` | `stacked` (empilées, plus simple à modifier) · `adjoining` · `adjoining_grouped` (groupées par couleur) |
| `stroke_shapes` | `false` | Entourer chaque forme d'un contour de sa couleur |
| `dxf_mode` | `splines` | `splines` · `few_lines` · `many_lines` (CAO/CNC sans splines) |
| `bitmap_scale` | `1` | `1` · `2` · `4` (bitmap uniquement) |
| `overwrite` | `false` | Remplacer un fichier existant |
| `preview` | `true` | Renvoyer un aperçu PNG |
| `show_window` | `false` | Garder la fenêtre Vector Magic visible (débogage) |

### `vectorize_batch`

Mêmes options, plus `input_paths` (liste) **ou** `input_dir` (non récursif) et `output_dir`. Un résultat par image ; un échec n'arrête pas le lot.

### `get_vector_magic_status`

Chemin d'installation, version, fenêtres Vector Magic ouvertes, formats pris en charge et délais.

## Fonctionnement

1. Copie l'image dans un dossier temporaire et sauvegarde les réglages de Vector Magic (`HKCU\Software\Vector Magic`).
2. Écrit les options d'export, lance un **nouveau** `vmde.exe` et déplace sa fenêtre hors écran.
3. Exécute **Entièrement automatique**, applique détail/couleurs sur la page de révision et utilise **Enregistrement rapide** (sans boîte de dialogue).
4. Copie le résultat à destination, ferme sa fenêtre et restaure vos réglages.

Les clics sont des messages envoyés à la fenêtre (votre curseur ne bouge jamais) ; la page de l'assistant est reconnue par le nom des widgets (UI Automation) et les réglages sont confirmés en lisant la barre d'état avec l'OCR de Windows. Une conversion à la fois ; un logo typique prend 10 à 20 s.

## Configuration

| Variable | Défaut | |
| --- | --- | --- |
| `VECTOR_MAGIC_EXE` | `C:\Program Files (x86)\Vector Magic\vmde.exe` | Chemin de `vmde.exe` ou de son dossier |
| `VECTOR_MAGIC_LOAD_TIMEOUT` | `90` | Secondes pour ouvrir l'image |
| `VECTOR_MAGIC_VECTORIZE_TIMEOUT` | `300` | Secondes par passe de vectorisation |
| `VECTOR_MAGIC_SAVE_TIMEOUT` | `120` | Secondes pour écrire le fichier |

## Limites

- Windows uniquement ; testé avec Vector Magic Desktop Edition 1.15 en interface espagnole. La détection des pages utilise les noms de widgets et ne dépend pas de la langue.
- Utilise le mode Entièrement automatique ; les assistants Basique/Avancé et l'édition manuelle ne sont pas (encore) automatisés.
- Le `vector_magic_summary` est lu par OCR et peut omettre une lettre ; il est indicatif.

## Confidentialité

Tout s'exécute localement, sans requête réseau ni télémétrie. Les images sont copiées dans un dossier temporaire supprimé après chaque exécution.

## Licence

[MIT](LICENSE). Vector Magic est une marque de Vector Magic, Inc. Ce projet n'est ni affilié ni approuvé par Vector Magic, Inc. — une copie sous licence de Vector Magic Desktop Edition est nécessaire.
