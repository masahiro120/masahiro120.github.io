# masahiro120.github.io

このリポジトリは、個人サイト用の静的 HTML と、各ページで使う JavaScript・Python補助スクリプト・CSVデータをまとめたものです。

## 概要

- ルートの `index.html` を入口に、趣味ページ・業務系ツールページへ遷移する構成
- `hobby/` 配下に学習用・趣味用のページを配置
- `work/` 配下に実務向けの計算・記録ページを配置
- `css/site.css` に共通スタイルを集約

## 主要ファイル

- `index.html`: サイトトップ
- `module.js`: トップページ共通の簡易スクリプト
- `css/site.css`: 共通スタイル
- `push.sh`: デプロイや push 用の補助スクリプト

## ディレクトリ構成

### ルート

- `css/`
	- `site.css`
- `hobby/`
	- `hobby.html`
	- `monster/`
		- `fusion_tree.html`
		- `fusion_tree2.html`
		- `fusion_tree.py`
		- `fusion_tree_v2.py`
		- `py_program.py`
		- `py_program_v2.py`
		- `py_program_v3.py`
		- `monsters.csv`
		- `output.txt`
		- `monsters_list/`（ランク別 CSV）
	- `quadratic_function/`
		- `quadratic.html`
		- `quadratic_old.html`
		- `module.js`
		- `py_program.py`
	- `training/`
		- `training.html`
		- `database_test.html`
- `work/`
	- `work.html`
	- `income_tax/`
		- `income.html`
		- `module.js`
		- `py_program.py`
		- `resident_tax.csv`
	- `rent/`
		- `rent.html`
		- `module.js`
	- `supabase/`
		- `supabase.html`
		- `supabase_sleep.html`

## 実行方法

静的サイトなので、ローカルサーバーで開くと確認しやすいです。

例（Python）:

```bash
python3 -m http.server 8000
```

ブラウザで以下を開きます。

- http://localhost:8000/index.html

## 外部公開（cloudflared）

ローカルサーバーを外部に公開する場合は、以下のコマンドを実行します。

```bash
cloudflared tunnel --url http://localhost:8000
```

## 補足

- 一部に `.DS_Store` などの macOS 生成ファイルが含まれます。
- Python ファイルは補助スクリプトとして置かれており、ページ本体は主に HTML/JS で動作します。
