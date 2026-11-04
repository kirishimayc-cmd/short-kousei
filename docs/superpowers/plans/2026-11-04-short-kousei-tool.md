# ショート構成分析ツール Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 研究・企画・振り返りを1本で回す、MY TOOL用のオフラインHTML1枚のショート構成分析ツールを作る。

**Architecture:** 開発時は `src/` に責務ごとのJS/CSSを分け、`build.py` で1枚の `dist/short-kousei.html` にインライン結合する。純粋ロジック（モデル・計算・JSON検証）は Node のテストで、画面は Playwright（Chromium）で検証する。保存は IndexedDB。

**Tech Stack:** 素のHTML/CSS/JavaScript（ES2020、外部ライブラリなし）、IndexedDB、getDisplayMedia、Python 3（ビルド）、Node 18+ `node:test`、Playwright for Python。

**Spec:** `docs/superpowers/specs/2026-11-04-short-kousei-tool-design.md`

## Global Constraints

- 成果物は HTML1枚 `dist/short-kousei.html`。外部ファイル・CDN・ネット接続なしで動く（動画再生のみネット）。
- 対象: Windows + Chrome / Edge（PC）。`file://` で開いて動くこと。
- 保存は IndexedDB（DB名 `short-kousei`, version 1）。localStorage は使わない。
- スクショは JPEG 品質0.85、長辺1080px上限に縮小。
- 種別: `research`（研究）／`plan`（企画）／`posted`（自分の投稿）。画面表示は日本語。
- 初期ブロック種類: フック／前振り／展開／オチ／CTA（追加・名前変更・色変更可）。
- UI文言はすべて日本語。

## Review Focus

1. 尺が未入力（0）のショート → オチ位置％・帯グラフが NaN/Infinity にならず「—」表示。
2. ブロックの開始秒 > 終了秒、または尺超え → 保存時に入れ替え／尺に丸める。
3. 画面共有を途中で止めた（タブ側の「共有を停止」）→ 📸 ボタンが「共有をやり直す」に戻る。
4. 型の元ショートを削除 → 型は残り、「この型で企画を作る」も動く。
5. 読み込みJSONが別ツールのもの／壊れている → 既存データは一切変わらずエラー表示。

---

## File Structure

- `src/model.js` — データ生成・正規化（`newShort`, `normalizeShort`, `newTemplate`, `templateFromShort`, `shortFromTemplate`）。DOM非依存。
- `src/analysis.js` — 指標計算（`metrics`, `templateStats`）。DOM非依存。
- `src/backup.js` — JSON書き出し・検証（`exportData`, `validateImport`）。DOM非依存。
- `src/db.js` — IndexedDB ラッパ（`openDB`, `getAll`, `put`, `del`, `clearAll`）。
- `src/capture.js` — 画面共有と撮影（`startShare`, `isSharing`, `grabFrame`, `onShareEnded`）。
- `src/ui/*.js` — 画面（`list.js`, `edit.js`, `templates.js`, `analyze.js`, `app.js`）。
- `src/style.css`, `src/index.html`（`<!--CSS-->` `<!--JS-->` の差し込み口つき）
- `build.py` — 結合して `dist/short-kousei.html` を出力。
- `tests/unit/*.test.mjs` — Node テスト（`src/*.js` は `export` なしのグローバル関数＋末尾で `if (typeof module!=='undefined') module.exports = {...}`）。
- `tests/e2e/test_app.py` — Playwright。

---

### Task 1: モデル（model.js）

**Files:** Create `src/model.js`, `tests/unit/model.test.mjs`

**Interfaces — Produces:**
- `newShort(kind: 'research'|'plan'|'posted') -> Short`  
  `Short = {id, kind, title, url, channel, duration, postedAt, views, likes, comments, templateId, tags:[], blocks:[{type,start,end,memo}], cuts:[{t,memo}], telops:[{t,text,font,size,color,pos,memo}], ses:[{t,kind,memo}], shots:[{id,img,t,notes:[{label,body}]}], memos:[{title,body}], createdAt, updatedAt}`
- `normalizeShort(s: Short) -> Short` — 数値化、ブロック start>end を入れ替え、duration>0 なら start/end を [0,duration] に丸め、blocks/cuts/telops/ses を時刻順に並べる。
- `DEFAULT_BLOCK_TYPES = [{name:'フック',color:'#e4572e'},{name:'前振り',color:'#f3a712'},{name:'展開',color:'#4c9f70'},{name:'オチ',color:'#3d5a80'},{name:'CTA',color:'#9b5de5'}]`
- `templateFromShort(s, name) -> Template` `Template = {id, name, sourceId, duration, blocks:[{type, startRatio, endRatio, memo}], notes:{cut, telop, se}}`（duration 0 の時 ratio は null）
- `shortFromTemplate(t, duration) -> Short`（kind `plan`、`templateId=t.id`、ratio×duration で秒に戻す。duration 0 なら t.duration を使う）

- [ ] Step 1: テスト — `newShort('plan').kind==='plan'`、配列はすべて空、id は一意。`normalizeShort` に `{duration:30, blocks:[{start:10,end:5},{start:25,end:40}]}` → `[{start:5,end:10},{start:25,end:30}]`。`templateFromShort`→`shortFromTemplate(t,60)` で `{start:0,end:3}`（尺30）が `{start:0,end:6}` になる。尺0の型でも例外なし。
- [ ] Step 2: `node --test tests/unit` → FAIL
- [ ] Step 3: 実装
- [ ] Step 4: `node --test tests/unit` → PASS
- [ ] Step 5: Commit `feat: data model`

### Task 2: 分析計算（analysis.js）

**Files:** Create `src/analysis.js`, `tests/unit/analysis.test.mjs`

**Interfaces — Produces:**
- `metrics(s: Short) -> {hookSec: number|null, punchPct: number|null, hasCTA: boolean, cutCount: number, avgCutSec: number|null}`
  - hookSec = 種類「フック」の最初のブロックの end−start、なければ null
  - punchPct = 「オチ」最初のブロック start / duration ×100（四捨五入、duration 0 なら null）
  - avgCutSec = duration / (cutCount+1)（小数1桁、duration 0 なら null）
- `templateStats(templateId, shorts) -> {count, avgViews: number|null}`（kind `posted` のみ対象）

- [ ] Step 1: テスト — 尺30・フック0-2・オチ24-30・カット5件 → `{hookSec:2,punchPct:80,hasCTA:false,cutCount:5,avgCutSec:5}`。尺0 → punchPct/avgCutSec が null。templateStats: posted 2件（100,300）+ plan 1件 → `{count:2,avgViews:200}`、0件 → `{count:0,avgViews:null}`。
- [ ] Step 2: FAIL 確認 → Step 3: 実装 → Step 4: PASS → Step 5: Commit `feat: analysis metrics`

### Task 3: バックアップ（backup.js）

**Files:** Create `src/backup.js`, `tests/unit/backup.test.mjs`

**Interfaces — Produces:**
- `exportData({shorts, templates, blockTypes}) -> string`（`{app:'short-kousei', version:1, exportedAt, shorts, templates, blockTypes}` の JSON）
- `validateImport(text: string) -> {ok:true, data} | {ok:false, error: string}` — JSON不正、`app!=='short-kousei'`、配列欠落でエラー（日本語メッセージ）。

- [ ] Step 1: テスト — export→validate で往復一致。`'{'` → ok:false。`{"app":"other"}` → ok:false。
- [ ] Step 2–5: FAIL → 実装 → PASS → Commit `feat: backup export/validate`

### Task 4: 骨組み・DB・ビルド

**Files:** Create `src/db.js`, `src/index.html`, `src/style.css`, `src/ui/app.js`, `build.py`, `tests/e2e/test_app.py`

**Interfaces — Produces:**
- `openDB() -> Promise<IDBDatabase>`（stores: `shorts`, `templates`, `settings`; keyPath `id`）
- `getAll(store) -> Promise<any[]>`, `put(store, obj) -> Promise`, `del(store, id) -> Promise`, `clearAll() -> Promise`
- `App.state = {shorts, templates, blockTypes}`, `App.go(tab, arg?)`, `App.save(short)`, `App.saveTemplate(t)`, `App.remove(store,id)`
- タブ: `#tab-list`, `#tab-edit`, `#tab-templates`, `#tab-analyze`（ボタン `[data-tab=...]`）
- 設定ボタン: JSON書き出し／読み込み（「追加」か「置き換え」を選択）。読み込み失敗時は何も書き換えず `.toast.error` 表示。
- `python3 build.py` → `dist/short-kousei.html`

- [ ] Step 1: e2e テスト `test_tabs_switch`（4タブ切替で該当セクションが表示）、`test_import_broken_keeps_data`（1件作成→壊れたJSON読み込み→件数1のまま、エラー表示）。`file://` で dist を開く。
- [ ] Step 2: FAIL → Step 3: 実装 → Step 4: `python3 build.py && pytest tests/e2e -q` PASS → Step 5: Commit `feat: app shell, db, build`

### Task 5: 編集画面（基本情報・構成・カット・テロップ・SE・メモ）

**Files:** Create `src/ui/edit.js`; Modify `src/style.css`; Test `tests/e2e/test_app.py`

**Interfaces — Consumes:** Task1 モデル、`App.save`。**Produces:** `renderEdit(short)`、帯グラフ `renderBand(short, blockTypes) -> HTMLElement`（一覧・分析でも使用、尺0なら「尺未入力」表示）

- 基本情報（種別・タイトル・URL・チャンネル・尺・投稿日・再生数・高評価・コメント・タグ）
- ブロックボタン（種類ごと）→ 開始/終了/メモの行追加。ブロック種類の追加・名前変更・色変更（settings に保存）
- カット: 「カット＋」で現在の秒数入力欄の値で追加、カット数・平均カット秒数を表示
- テロップ表（秒・内容・フォント・サイズ・色・位置・メモ）、SE表（秒・種類・メモ）、自由メモ（見出し＋本文、複数）
- 入力は 500ms デバウンスで自動保存（`normalizeShort` を通す）
- 「型として保存」→ 名前入力 → `templateFromShort`
- 削除は `confirm` つき

- [ ] Step 1: e2e `test_edit_persists`（全セクションに1件ずつ入れてリロード後も残る、カット数表示「3」）、`test_block_swap`（開始12 終了4 → 4–12 に直る）
- [ ] Step 2–5: FAIL → 実装 → build+PASS → Commit `feat: edit screen`

### Task 6: 動画小窓とワンタップスクショ

**Files:** Create `src/capture.js`; Modify `src/ui/edit.js`

**Interfaces — Produces:**
- `startShare() -> Promise<void>`（`getDisplayMedia({video:true, audio:false})`、隠し `<video>` に流す）
- `isSharing() -> boolean`、`onShareEnded(cb)`（track `ended` で発火）
- `grabFrame() -> Promise<string>`（dataURL JPEG 0.85、長辺1080上限）

- 「▶ 小窓で再生」: `window.open(url, 'shortPlayer', 'width=420,height=760')`。null ならポップアップ許可の案内＋通常リンク表示。
- 「📸」: 未共有なら「画面共有を開始（小窓を選んでください）」、共有中なら撮影して `shots` に追加（t は現在の秒数入力欄の値）。共有終了で表示が「共有をやり直す」に戻る。
- スクショ一覧: サムネ、秒数、メモ（ラベル＋本文）複数追加・削除、クリックで拡大オーバーレイ。

- [ ] Step 1: e2e `test_capture_saves_shot` — Chromium を `--use-fake-ui-for-media-stream --auto-select-desktop-capture-source=Entire screen` 等で起動、または `page.add_init_script` で `navigator.mediaDevices.getDisplayMedia` を canvas の `captureStream()` に差し替え。📸2回 → shots 1件（1回目は共有開始）、画像の長辺 ≤1080。`test_share_end_resets` — track.stop() 後にボタン文言が「共有をやり直す」。
- [ ] Step 2–5: FAIL → 実装 → build+PASS → Commit `feat: player window and capture`

### Task 7: 一覧・型・分析画面

**Files:** Create `src/ui/list.js`, `src/ui/templates.js`, `src/ui/analyze.js`

**Interfaces — Consumes:** `renderBand`, `metrics`, `templateStats`, `shortFromTemplate`

- 一覧: カード（タイトル・種別バッジ・帯・カット数・再生数・サムネ1枚）、種別絞り込み、キーワード（タイトル/タグ/メモ）検索、並べ替え（再生数／投稿日／登録日）、「＋新規」。
- 型: 一覧（名前・帯・件数・平均再生数）、「この型で企画を作る」→ 新規 plan を編集画面で開く、削除。元ショート削除後も動く。
- 分析: 種別絞り込み、再生数降順で帯を縦に並べる、表（タイトル・再生数・高評価・コメント・フック秒・オチ位置%・CTA・カット数・平均カット秒）、null は「—」。

- [ ] Step 1: e2e `test_template_flow`（型保存→元削除→型から企画作成→ブロック秒数が尺比で入る）、`test_analyze_table`（尺0の行が「—」、NaN の文字列が画面に無い）、`test_list_filter_sort`
- [ ] Step 2–5: FAIL → 実装 → build+PASS → Commit `feat: list, templates, analyze`

### Task 8: 仕上げ確認

- [ ] `node --test tests/unit && python3 build.py && pytest tests/e2e -q` 全PASS
- [ ] スクリーンショットで4画面の見た目を確認し、崩れを直す
- [ ] Commit `chore: polish`
