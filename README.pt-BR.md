<p align="center"><img src="icon.png" width="120" alt="Ícone do Vector Magic Bridge"></p>

<h1 align="center">VectorMagic MCP Server</h1>

<p align="center">
  <a href="README.md">English</a> · <a href="README.es.md">Español</a> · <b>Português</b> · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a> · <a href="README.ja.md">日本語</a>
</p>

<p align="center">
  Deixe o Claude vetorizar qualquer imagem com o <b>Vector Magic Desktop Edition</b> instalado no seu PC com Windows —<br>
  PNG, JPG, GIF, PSD, TIFF… → <b>SVG, AI, EPS, PDF, DXF ou EMF</b> editáveis.
</p>

---

## Por quê

O Vector Magic Desktop Edition é um dos melhores vetorizadores automáticos, mas **não tem linha de comando nem API** — apenas um assistente gráfico. Este servidor [Model Context Protocol](https://modelcontextprotocol.io) controla essa interface para você, então você pode pedir ao Claude coisas como:

> *"Vetorize `D:\logos\cliente.png` como EPS com detalhe baixo."*
> *"Converta todas as imagens de `D:\scans` para SVG com cores ilimitadas e salve em `D:\scans\vector`."*

Inspirado em [ie3jp/illustrator-mcp-server](https://github.com/ie3jp/illustrator-mcp-server); o resultado abre direto no Illustrator, Inkscape, CorelDRAW, AutoCAD etc.

## Recursos

| | |
| --- | --- |
| **Entrada** | png, jpg, jpeg, bmp, tif, tiff, gif, psd, jp2, pcx, ppm, pnm, pgm, pbm, tga, jng, mng, xpm |
| **Saída vetorial** | svg, ai, eps, pdf, dxf, emf |
| **Saída bitmap** | png, jpg, bmp, tif — renderizada a partir do vetor em 1×, 2× ou 4× |
| **Opções** | nível de detalhe, modo de cor, disposição das formas, contornos, modo de curvas DXF |
| **Lote** | uma lista de arquivos ou uma pasta inteira em uma chamada |
| **Retorno** | prévia do resultado vetorial + o que o Vector Magic detectou (tipo de imagem, detalhe, cores) |
| **Seguro** | nunca sobrescreve arquivos, nunca mexe nas janelas do Vector Magic que você tem abertas, restaura suas configurações do Vector Magic após cada execução, funciona offline |

## Requisitos

- Windows 10/11
- **Vector Magic Desktop Edition** (testado com a **1.15**), licenciado e ativado
- Node.js ≥ 20 (incluído no Claude Desktop para instalações `.mcpb`)

## Instalação

### Claude Desktop (recomendado)

1. Baixe `vectormagic-mcp-server.mcpb` da [última release](https://github.com/jhonsu01/VectorMagic-mcp-server/releases/latest).
2. Dê um duplo clique (ou arraste para Claude Desktop → *Configurações → Extensões*) e clique em **Instalar**.
3. Opcional: se o Vector Magic não estiver em `C:\Program Files (x86)\Vector Magic`, informe o caminho do `vmde.exe` nas configurações da extensão.

### Claude Code / outros clientes MCP

```bash
git clone https://github.com/jhonsu01/VectorMagic-mcp-server.git
cd VectorMagic-mcp-server
npm install
npm run build
claude mcp add vectormagic -- node "%CD%\dist\bundle.cjs"
```

```json
{
  "mcpServers": {
    "vectormagic": {
      "command": "node",
      "args": ["C:\\caminho\\VectorMagic-mcp-server\\dist\\bundle.cjs"],
      "env": { "VECTOR_MAGIC_EXE": "C:\\Program Files (x86)\\Vector Magic\\vmde.exe" }
    }
  }
}
```

## Ferramentas

### `vectorize_image`

| Parâmetro | Padrão | Descrição |
| --- | --- | --- |
| `input_path` | — | Caminho absoluto da imagem |
| `output_path` | ao lado da entrada | Caminho absoluto de saída; a extensão deve corresponder a `format` |
| `format` | `svg` | `svg` `ai` `eps` `pdf` `dxf` `emf` · bitmap: `png` `jpg` `bmp` `tif` |
| `detail` | `auto` | `auto` · `high` · `medium` · `low` |
| `colors` | `auto` | `auto` (paleta reduzida, logos) · `unlimited` (fotos, degradês) |
| `shape_mode` | `stacked` | `stacked` (empilhadas, mais fácil de editar) · `adjoining` · `adjoining_grouped` (agrupadas por cor) |
| `stroke_shapes` | `false` | Contornar cada forma com um traço da sua cor |
| `dxf_mode` | `splines` | `splines` · `few_lines` · `many_lines` (CAD/CNC sem suporte a splines) |
| `bitmap_scale` | `1` | `1` · `2` · `4` (somente bitmap) |
| `overwrite` | `false` | Substituir um arquivo existente |
| `preview` | `true` | Retornar uma prévia PNG do resultado |
| `show_window` | `false` | Manter a janela do Vector Magic visível (depuração) |

### `vectorize_batch`

Mesmas opções, mais `input_paths` (lista) **ou** `input_dir` (não recursivo) e `output_dir`. Um resultado por imagem; uma falha não interrompe o lote.

### `get_vector_magic_status`

Caminho de instalação, versão, janelas do Vector Magic abertas, formatos suportados e tempos limite.

## Como funciona

1. Copia a imagem para uma pasta temporária e faz backup das configurações do Vector Magic (`HKCU\Software\Vector Magic`).
2. Grava as opções de exportação, inicia um `vmde.exe` **novo** e move a janela para fora da tela.
3. Executa **Totalmente Automático**, aplica detalhe/cores na página de revisão e usa **Salvamento Rápido** (sem diálogos).
4. Copia o resultado para o destino, fecha a janela e restaura suas configurações.

Os cliques são mensagens enviadas à janela (seu cursor nunca se move); a página do assistente é identificada pelos nomes dos widgets (UI Automation) e as configurações são confirmadas lendo a barra de status com o OCR do Windows. Uma conversão por vez; um logo típico leva 10–20 s.

## Configuração

| Variável | Padrão | |
| --- | --- | --- |
| `VECTOR_MAGIC_EXE` | `C:\Program Files (x86)\Vector Magic\vmde.exe` | Caminho do `vmde.exe` ou da pasta |
| `VECTOR_MAGIC_LOAD_TIMEOUT` | `90` | Segundos para abrir a imagem |
| `VECTOR_MAGIC_VECTORIZE_TIMEOUT` | `300` | Segundos por passada de vetorização |
| `VECTOR_MAGIC_SAVE_TIMEOUT` | `120` | Segundos para gravar o arquivo |

## Limitações

- Somente Windows; testado com o Vector Magic Desktop Edition 1.15 com interface em espanhol. A detecção de páginas usa nomes de widgets e não depende do idioma.
- Usa o fluxo Totalmente Automático; os assistentes Básico/Avançado e a edição manual não são automatizados (ainda).
- O `vector_magic_summary` é lido por OCR e pode perder alguma letra; é apenas informativo.

## Privacidade

Tudo roda localmente, sem requisições de rede nem telemetria. As imagens são copiadas para uma pasta temporária apagada após cada execução.

## Licença

[MIT](LICENSE). Vector Magic é marca da Vector Magic, Inc. Este projeto não é afiliado nem endossado pela Vector Magic, Inc. — você precisa da sua própria cópia licenciada do Vector Magic Desktop Edition.
