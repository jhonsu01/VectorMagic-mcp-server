<p align="center"><img src="icon.png" width="120" alt="Vector Magic Bridge アイコン"></p>

<h1 align="center">VectorMagic MCP Server</h1>

<p align="center">
  <a href="README.md">English</a> · <a href="README.es.md">Español</a> · <a href="README.pt-BR.md">Português</a> · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a> · <b>日本語</b>
</p>

<p align="center">
  Windows PC にインストールされた <b>Vector Magic Desktop Edition</b> で、Claude があらゆる画像をベクター化します —<br>
  PNG・JPG・GIF・PSD・TIFF… → 編集可能な <b>SVG・AI・EPS・PDF・DXF・EMF</b>。
</p>

---

## なぜ必要か

Vector Magic Desktop Edition は優れた自動トレースソフトですが、**コマンドラインも API もなく**、ウィザード形式の GUI しかありません。この [Model Context Protocol](https://modelcontextprotocol.io) サーバーがその GUI を代わりに操作するので、Claude に次のように頼めます。

> 「`D:\logos\client.png` を詳細度「低」で EPS にベクター化して」
> 「`D:\scans` の画像をすべて無制限カラーの SVG に変換して `D:\scans\vector` に保存して」

[ie3jp/illustrator-mcp-server](https://github.com/ie3jp/illustrator-mcp-server) に着想を得ています。結果は Illustrator・Inkscape・CorelDRAW・AutoCAD などでそのまま開けます。

## 機能

| | |
| --- | --- |
| **入力** | png, jpg, jpeg, bmp, tif, tiff, gif, psd, jp2, pcx, ppm, pnm, pgm, pbm, tga, jng, mng, xpm |
| **ベクター出力** | svg, ai, eps, pdf, dxf, emf |
| **ビットマップ出力** | png, jpg, bmp, tif — ベクター結果から 1×・2×・4× で再描画 |
| **オプション** | 詳細度、カラーモード、シェイプの配置、線、DXF の曲線モード |
| **一括処理** | ファイルのリストまたはフォルダー全体を 1 回の呼び出しで |
| **結果** | ベクター結果のプレビュー画像 + Vector Magic の判定内容（画像タイプ・詳細度・色数） |
| **安全性** | ファイルを上書きしない、開いている Vector Magic のウィンドウには触れない、実行ごとに Vector Magic の設定を元に戻す、オフラインで動作 |

## 動作要件

- Windows 10/11
- **Vector Magic Desktop Edition**（**1.15** で検証）、ライセンス認証済み
- Node.js 20 以上（`.mcpb` でインストールする場合は Claude Desktop に同梱）

## インストール

### Claude Desktop（推奨）

1. [最新リリース](https://github.com/jhonsu01/VectorMagic-mcp-server/releases/latest)から `vectormagic-mcp-server.mcpb` をダウンロード。
2. ダブルクリック（または Claude Desktop の「設定 → 拡張機能」にドラッグ）して **インストール** をクリック。
3. 任意: Vector Magic が `C:\Program Files (x86)\Vector Magic` 以外にある場合は、拡張機能の設定で `vmde.exe` のパスを指定。

### Claude Code / その他の MCP クライアント

```bash
git clone https://github.com/jhonsu01/VectorMagic-mcp-server.git
cd VectorMagic-mcp-server
npm install
npm run build
claude mcp add vectormagic -- node "%CD%\dist\bundle.cjs"
```

## ツール

### `vectorize_image`

| パラメーター | 既定値 | 説明 |
| --- | --- | --- |
| `input_path` | — | 画像の絶対パス |
| `output_path` | 入力と同じ場所 | 出力の絶対パス（拡張子は `format` と一致させる） |
| `format` | `svg` | `svg` `ai` `eps` `pdf` `dxf` `emf` · ビットマップ: `png` `jpg` `bmp` `tif` |
| `detail` | `auto` | `auto` · `high` · `medium` · `low` |
| `colors` | `auto` | `auto`（減色パレット、ロゴ向け） · `unlimited`（写真・グラデーション向け） |
| `shape_mode` | `stacked` | `stacked`（重ねて配置、最も編集しやすい） · `adjoining` · `adjoining_grouped`（色ごとにグループ化） |
| `stroke_shapes` | `false` | 各シェイプに同色の線を付ける |
| `dxf_mode` | `splines` | `splines` · `few_lines` · `many_lines`（スプライン非対応の CAD/CNC 向け） |
| `bitmap_scale` | `1` | `1` · `2` · `4`（ビットマップのみ） |
| `overwrite` | `false` | 既存ファイルを置き換える |
| `preview` | `true` | PNG プレビューを返す |
| `show_window` | `false` | Vector Magic のウィンドウを画面上に表示したままにする（デバッグ用） |

### `vectorize_batch`

同じオプションに加え、`input_paths`（リスト）**または** `input_dir`（再帰なし）と `output_dir`。画像ごとに結果を返し、1 件の失敗で処理は止まりません。

### `get_vector_magic_status`

インストールパス、バージョン、開いている Vector Magic のウィンドウ、対応形式、タイムアウト。

## 仕組み

1. 画像を一時フォルダーにコピーし、Vector Magic の設定（`HKCU\Software\Vector Magic`）をバックアップ。
2. 書き出しオプションを書き込み、**新しい** `vmde.exe` を起動してウィンドウを画面外へ移動。
3. **全自動** を実行し、確認ページで詳細度・色を適用して **クイック保存**（ダイアログなし）。
4. 結果を保存先にコピーし、ウィンドウを閉じて設定を元に戻す。

クリックはウィンドウへ送るメッセージで行うため、マウスカーソルは動きません。ウィザードのページはウィジェット名（UI Automation）で判定し、設定は Windows の OCR でステータスバーを読んで確認します。変換は 1 件ずつで、一般的なロゴは 10〜20 秒です。

## 設定

| 変数 | 既定値 | |
| --- | --- | --- |
| `VECTOR_MAGIC_EXE` | `C:\Program Files (x86)\Vector Magic\vmde.exe` | `vmde.exe` またはそのフォルダーのパス |
| `VECTOR_MAGIC_LOAD_TIMEOUT` | `90` | 画像を開くまでの秒数 |
| `VECTOR_MAGIC_VECTORIZE_TIMEOUT` | `300` | ベクター化 1 回あたりの秒数 |
| `VECTOR_MAGIC_SAVE_TIMEOUT` | `120` | ファイル書き出しの秒数 |

## 制限事項

- Windows のみ。Vector Magic Desktop Edition 1.15（スペイン語 UI）で検証済み。ページ判定はウィジェット名を使うため言語に依存しません。
- 全自動モードを使用します。ベーシック/詳細ウィザードや手動編集は（まだ）自動化していません。
- `vector_magic_summary` は OCR で読み取るため、文字が欠けることがあります（参考情報です）。

## プライバシー

すべてローカルで動作し、ネットワーク通信やテレメトリーはありません。画像は一時フォルダーにコピーされ、実行ごとに削除されます。

## ライセンス

[MIT](LICENSE)。Vector Magic は Vector Magic, Inc. の商標です。本プロジェクトは Vector Magic, Inc. とは無関係で、承認も受けていません。Vector Magic Desktop Edition のライセンスは各自で必要です。
