// ===== ui/edit.js : 編集画面 =====
var EditUI = { curT: 0, saveTimer: null, draft: null, showTypes: false };

var TELOP_POS = ['上', '中央', '下', '左上', '右上', '左下', '右下', '顔の横'];
var SE_KINDS = ['ドン', 'シュッ', 'ポン', 'キラーン', 'ピコン', 'ジャン', 'ドゥルルル', '笑い声', '拍手', 'ブブー', '効果音なし（無音）'];
var NOTE_LABELS = ['構図', 'テロップ', '表情・動き', '色・エフェクト', 'その他'];
var MEMO_PRESETS = ['気づき', 'マネしたい点', '改善点', '台本メモ'];

function editScheduleSave() {
  clearTimeout(EditUI.saveTimer);
  EditUI.saveTimer = setTimeout(editSaveNow, 500);
  editRefreshDerived();
}
function editSaveNow() {
  clearTimeout(EditUI.saveTimer);
  if (!EditUI.draft) return Promise.resolve();
  return App.save(EditUI.draft);
}
window.addEventListener('beforeunload', function () { if (EditUI.draft) editSaveNow(); });

function editRefreshDerived() {
  var s = normalizeShort(EditUI.draft);
  var bandBox = document.getElementById('edit-band');
  if (bandBox) { bandBox.innerHTML = ''; bandBox.appendChild(renderBand(s, { scale: true })); }
  var m = metrics(s);
  var cc = document.getElementById('cut-count'); if (cc) cc.textContent = String(m.cutCount);
  var st = document.getElementById('edit-stats');
  if (st) {
    st.innerHTML = '';
    [['フック', dash(m.hookSec, '秒')], ['オチ位置', dash(m.punchPct, '%')], ['CTA', m.hasCTA ? 'あり' : 'なし'],
     ['カット', m.cutCount + '回'], ['平均カット', dash(m.avgCutSec, '秒')]].forEach(function (p) {
      st.appendChild(h('span', null, p[0] + ' ', h('b', { text: p[1] })));
    });
  }
  var badge = document.getElementById('edit-badge');
  if (badge) { badge.className = 'badge ' + s.kind; badge.textContent = KIND_LABELS[s.kind]; }
}

function inp(type, value, oninput, attrs) {
  var a = Object.assign({ type: type, value: value == null ? '' : value }, attrs || {});
  a.oninput = function (e) { oninput(e.target.value, e); editScheduleSave(); };
  return h('input', a);
}

function field(label, control) { return h('div', { class: 'field' }, h('label', { text: label }), control); }

function datalist(id, items) {
  return h('datalist', { id: id }, items.map(function (x) { return h('option', { value: x }); }));
}

// ---- 汎用の行テーブル ----
function rowsBox(opt) {
  var S = EditUI.draft;
  var box = h('div', { class: 'box', id: opt.id });
  function draw() {
    box.innerHTML = '';
    var list = S[opt.key];
    list.sort(function (a, b) { return (Number(a.t) || 0) - (Number(b.t) || 0); });
    box.appendChild(h('h3', null, opt.title, opt.badge ? opt.badge() : null, h('span', { class: 'sub', text: opt.sub || '' })));
    if (opt.extra) box.appendChild(opt.extra());
    if (list.length) {
      var tb = h('tbody');
      list.forEach(function (r, i) {
        var tr = h('tr', { class: opt.rowClass });
        tr.appendChild(h('td', null, inp('number', r.t, function (v) { r.t = v; }, { class: 't r-t', step: '0.1', min: '0', title: '秒' })));
        opt.cols.forEach(function (c) {
          tr.appendChild(h('td', null, inp('text', r[c.key], function (v) { r[c.key] = v; },
            { class: 'r-' + c.key, placeholder: c.ph || '', list: c.list || null })));
        });
        tr.appendChild(h('td', { class: 'x' }, h('button', { class: 'xbtn', title: '削除', onclick: function () { list.splice(i, 1); editScheduleSave(); draw(); } }, '×')));
        tb.appendChild(tr);
      });
      box.appendChild(h('table', { class: 'rows' },
        h('thead', null, h('tr', null, h('th', { text: '秒' }), opt.cols.map(function (c) { return h('th', { text: c.label }); }), h('th'))), tb));
    } else {
      box.appendChild(h('p', { class: 'hint', text: opt.emptyHint }));
    }
    box.appendChild(h('div', { class: 'row addrow' },
      h('button', { class: 'btn small', id: opt.addId, onclick: function () { list.push(opt.make()); editScheduleSave(); draw(); } }, opt.addLabel)));
    if (opt.lists) opt.lists.forEach(function (dl) { box.appendChild(dl); });
  }
  draw();
  box.redraw = draw;
  return box;
}

// ---- 構成ブロック ----
function blocksBox() {
  var S = EditUI.draft;
  var box = h('div', { class: 'box', id: 'box-blocks' });
  function draw() {
    box.innerHTML = '';
    box.appendChild(h('h3', null, '構成', h('span', { class: 'sub', text: 'ボタン＝直前のブロックの終わり〜今の秒数を追加' }),
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn small ghost', id: 'manage-types', onclick: function () { EditUI.showTypes = !EditUI.showTypes; draw(); } }, EditUI.showTypes ? '閉じる' : 'ブロックの種類を編集')));
    box.appendChild(h('div', { id: 'edit-band' }));
    box.appendChild(h('div', { class: 'stats-inline', id: 'edit-stats' }));
    var btns = h('div', { class: 'blockbtns', style: { marginTop: '12px' } });
    App.state.blockTypes.forEach(function (bt) {
      btns.appendChild(h('button', { class: 'blockbtn', 'data-type': bt.name, style: { background: bt.color }, onclick: function () {
        var start = S.blocks.reduce(function (m, b) { return Math.max(m, Number(b.end) || 0); }, 0);
        var end = Math.max(start, Number(EditUI.curT) || 0);
        S.blocks.push({ type: bt.name, start: start, end: end, memo: '' });
        editScheduleSave(); draw();
      } }, '＋' + bt.name));
    });
    box.appendChild(btns);
    if (EditUI.showTypes) box.appendChild(typesManager(draw));
    S.blocks.sort(function (a, b) { return (Number(a.start) || 0) - (Number(b.start) || 0); });
    if (S.blocks.length) {
      var tb = h('tbody');
      S.blocks.forEach(function (b, i) {
        var sel = h('select', { class: 'b-type', onchange: function (e) { b.type = e.target.value; editScheduleSave(); } },
          App.state.blockTypes.map(function (bt) { return h('option', { value: bt.name, text: bt.name, selected: bt.name === b.type }); }));
        if (!App.state.blockTypes.some(function (bt) { return bt.name === b.type; })) sel.appendChild(h('option', { value: b.type, text: b.type, selected: true }));
        tb.appendChild(h('tr', { class: 'block-row' },
          h('td', { style: { width: '110px' } }, h('div', { class: 'row', style: { flexWrap: 'nowrap', gap: '5px' } }, h('span', { class: 'swatch', style: { background: App.blockColor(b.type) } }), sel)),
          h('td', null, inp('number', b.start, function (v) { b.start = v; }, { class: 't b-start', step: '0.1', min: '0' })),
          h('td', null, inp('number', b.end, function (v) { b.end = v; }, { class: 't b-end', step: '0.1', min: '0' })),
          h('td', null, inp('text', b.memo, function (v) { b.memo = v; }, { class: 'b-memo', placeholder: '何をしているか（例：結論を先に言う）' })),
          h('td', { class: 'x' }, h('button', { class: 'xbtn', title: '削除', onclick: function () { S.blocks.splice(i, 1); editScheduleSave(); draw(); } }, '×'))));
      });
      box.appendChild(h('table', { class: 'rows', style: { marginTop: '8px' } },
        h('thead', null, h('tr', null, h('th', { text: '種類' }), h('th', { text: '開始' }), h('th', { text: '終了' }), h('th', { text: 'メモ' }), h('th'))), tb));
    }
    editRefreshDerived();
  }
  draw();
  return box;
}

function typesManager(redraw) {
  var wrap = h('div', { class: 'memo', style: { marginBottom: '10px' } });
  App.state.blockTypes.forEach(function (bt, i) {
    var old = bt.name;
    var nameIn = h('input', { type: 'text', value: bt.name, style: { width: '140px', fontWeight: 400, marginBottom: 0 } });
    nameIn.addEventListener('change', function () {
      var nn = nameIn.value.trim();
      if (!nn || nn === old) { nameIn.value = old; return; }
      if (App.state.blockTypes.some(function (x) { return x.name === nn; })) { toast('同じ名前の種類があります', true); nameIn.value = old; return; }
      bt.name = nn;
      App.state.shorts.forEach(function (s) {
        if (s.blocks.some(function (b) { return b.type === old; })) {
          s.blocks.forEach(function (b) { if (b.type === old) b.type = nn; });
          if (s.id !== EditUI.draft.id) App.save(s);
        }
      });
      EditUI.draft.blocks.forEach(function (b) { if (b.type === old) b.type = nn; });
      App.saveBlockTypes(); editScheduleSave(); redraw();
    });
    wrap.appendChild(h('div', { class: 'row', style: { marginBottom: '6px' } },
      h('input', { type: 'color', value: bt.color, onchange: function (e) { bt.color = e.target.value; App.saveBlockTypes(); redraw(); } }),
      nameIn,
      h('button', { class: 'xbtn', title: '種類を削除', onclick: function () {
        if (!confirm('「' + bt.name + '」を種類から外します（入力済みのブロックは残ります）')) return;
        App.state.blockTypes.splice(i, 1); App.saveBlockTypes(); redraw();
      } }, '×')));
  });
  var ni = h('input', { type: 'text', id: 'new-type-name', placeholder: '新しい種類（例：回収）', style: { width: '180px', marginBottom: 0, fontWeight: 400 } });
  var ci = h('input', { type: 'color', value: '#6c757d' });
  wrap.appendChild(h('div', { class: 'row' }, ci, ni, h('button', { class: 'btn small', id: 'add-type', onclick: function () {
    var n = ni.value.trim();
    if (!n) return;
    if (App.state.blockTypes.some(function (x) { return x.name === n; })) { toast('同じ名前の種類があります', true); return; }
    App.state.blockTypes.push({ name: n, color: ci.value }); App.saveBlockTypes(); redraw();
  } }, '追加')));
  return wrap;
}

// ---- 自由メモ ----
function memosBox() {
  var S = EditUI.draft;
  var box = h('div', { class: 'box', id: 'box-memos' });
  function draw() {
    box.innerHTML = '';
    box.appendChild(h('h3', null, '自由メモ', h('span', { class: 'sub', text: '見出しをつけていくつでも' })));
    S.memos.forEach(function (m, i) {
      box.appendChild(h('div', { class: 'memo' },
        h('div', { class: 'row', style: { flexWrap: 'nowrap' } },
          inp('text', m.title, function (v) { m.title = v; }, { class: 'm-title', placeholder: '見出し', list: 'memo-presets' }),
          h('button', { class: 'xbtn', title: '削除', onclick: function () { if (!m.body || confirm('このメモを削除しますか？')) { S.memos.splice(i, 1); editScheduleSave(); draw(); } } }, '×')),
        h('textarea', { class: 'm-body', placeholder: '内容', oninput: function (e) { m.body = e.target.value; editScheduleSave(); } }, m.body || '')));
    });
    box.appendChild(h('div', { class: 'row addrow' },
      h('button', { class: 'btn small', id: 'add-memo', onclick: function () { S.memos.push({ title: MEMO_PRESETS[S.memos.length % MEMO_PRESETS.length], body: '' }); editScheduleSave(); draw(); } }, '＋ メモを追加')));
    box.appendChild(datalist('memo-presets', MEMO_PRESETS));
  }
  draw();
  return box;
}

// ---- 基本情報 ----
function infoBox() {
  var S = EditUI.draft;
  var kind = h('select', { id: 'f-kind', onchange: function (e) { S.kind = e.target.value; editScheduleSave(); } },
    Object.keys(KIND_LABELS).map(function (k) { return h('option', { value: k, text: KIND_LABELS[k], selected: k === S.kind }); }));
  var tplSel = h('select', { id: 'f-template', onchange: function (e) { S.templateId = e.target.value || null; editScheduleSave(); } },
    [h('option', { value: '', text: '（なし）' })].concat(App.state.templates.map(function (t) { return h('option', { value: t.id, text: t.name, selected: t.id === S.templateId }); })));
  return h('div', { class: 'box' },
    h('h3', null, '基本情報', h('span', { id: 'edit-badge', class: 'badge ' + S.kind, text: KIND_LABELS[S.kind] })),
    field('種別', kind),
    field('タイトル', inp('text', S.title, function (v) { S.title = v; }, { id: 'f-title', placeholder: '動画タイトル' })),
    field('URL', inp('url', S.url, function (v) { S.url = v; }, { id: 'f-url', placeholder: 'https://youtube.com/shorts/...' })),
    h('div', { class: 'fields2' },
      field('チャンネル', inp('text', S.channel, function (v) { S.channel = v; }, { id: 'f-channel' })),
      field('尺（秒）', inp('number', S.duration || '', function (v) { S.duration = v; }, { id: 'f-duration', min: '0', step: '0.1' }))),
    h('div', { class: 'fields3' },
      field('再生数', inp('number', S.views || '', function (v) { S.views = v; }, { id: 'f-views', min: '0' })),
      field('高評価', inp('number', S.likes || '', function (v) { S.likes = v; }, { id: 'f-likes', min: '0' })),
      field('コメント', inp('number', S.comments || '', function (v) { S.comments = v; }, { id: 'f-comments', min: '0' }))),
    h('div', { class: 'fields2' },
      field('投稿日', inp('date', S.postedAt, function (v) { S.postedAt = v; }, { id: 'f-postedAt' })),
      field('元にした型', tplSel)),
    field('タグ（カンマ区切り）', inp('text', S.tags.join(', '), function (v) {
      S.tags = v.split(/[,、，]/).map(function (x) { return x.trim(); }).filter(Boolean);
    }, { id: 'f-tags', placeholder: '例：猫, あるある' })),
    h('div', { class: 'row', style: { marginTop: '6px' } },
      h('button', { class: 'btn', id: 'save-template', onclick: function () {
        var name = prompt('型の名前', S.title ? S.title + 'の型' : '');
        if (name == null) return;
        editSaveNow();
        App.saveTemplate(templateFromShort(normalizeShort(S), name.trim() || '無題の型')).then(function () { toast('型「' + (name.trim() || '無題の型') + '」を保存しました'); });
      } }, '型として保存'),
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn danger', id: 'delete-short', onclick: function () {
        if (!confirm('「' + (S.title || '無題') + '」を削除します。元に戻せません。よろしいですか？')) return;
        var id = S.id; EditUI.draft = null; clearTimeout(EditUI.saveTimer);
        App.remove('shorts', id).then(function () { toast('削除しました'); App.go('list'); });
      } }, '削除')));
}

function timeBar() {
  function setT(v) { EditUI.curT = Math.max(0, Math.round(v * 10) / 10); ti.value = EditUI.curT; }
  var ti = h('input', { type: 'number', id: 'cur-t', step: '0.1', min: '0', value: EditUI.curT, oninput: function (e) { EditUI.curT = Number(e.target.value) || 0; } });
  function nudge(d) { return h('button', { class: 'btn small', onclick: function () { setT((Number(EditUI.curT) || 0) + d); } }, (d > 0 ? '+' : '') + d); }
  return h('div', { class: 'timebar' },
    h('span', { class: 'lbl', text: '今の秒数' }), ti, h('span', { class: 'lbl', text: '秒' }),
    nudge(-1), nudge(-0.5), nudge(0.5), nudge(1),
    h('span', { class: 'spacer' }),
    h('button', { class: 'btn primary', id: 'add-cut', title: '今の秒数でカットを追加', onclick: function () {
      EditUI.draft.cuts.push({ t: Number(EditUI.curT) || 0, memo: '' });
      editScheduleSave();
      var cb = document.getElementById('box-cuts'); if (cb && cb.redraw) cb.redraw();
      editRefreshDerived();
    } }, '✂ カット＋'));
}

function renderEdit(el) {
  var s = App.currentId && App.find(App.currentId);
  if (!s) {
    el.appendChild(h('div', { class: 'empty' }, h('div', { text: '一覧からショートを選ぶか、新しく作ってください。' }),
      h('div', { class: 'row', style: { justifyContent: 'center' } },
        h('button', { class: 'btn primary', onclick: function () { createShort('research'); } }, '＋ 研究（他所のショート）'),
        h('button', { class: 'btn', onclick: function () { createShort('plan'); } }, '＋ 企画'))));
    return;
  }
  if (!EditUI.draft || EditUI.draft.id !== s.id) { EditUI.draft = JSON.parse(JSON.stringify(s)); }
  var S = EditUI.draft;

  var left = h('div', { class: 'sticky-col' });
  if (window.playerBox) left.appendChild(playerBox());
  left.appendChild(infoBox());

  var right = h('div');
  right.appendChild(timeBar());
  right.appendChild(blocksBox());
  if (window.shotsBox) right.appendChild(shotsBox());
  right.appendChild(rowsBox({
    id: 'box-cuts', key: 'cuts', title: 'カット', rowClass: 'cut-row', addId: 'add-cut-row', addLabel: '＋ 行を追加',
    badge: function () { return h('span', { class: 'count', id: 'cut-count', text: String(S.cuts.length) }); },
    sub: '「✂ カット＋」で今の秒数を記録', emptyHint: '動画を見ながら、画面が切り替わるたびに「✂ カット＋」を押してください。',
    cols: [{ key: 'memo', label: 'カットのメモ', ph: '例：引き→寄り、ジャンプカット' }],
    make: function () { return { t: Number(EditUI.curT) || 0, memo: '' }; }
  }));
  right.appendChild(rowsBox({
    id: 'box-telops', key: 'telops', title: 'テロップ', rowClass: 'telop-row', addId: 'add-telop', addLabel: '＋ テロップを追加',
    emptyHint: '文字の内容だけでなく、フォント・大きさ・色・位置もメモしておくと再現しやすいです。',
    cols: [{ key: 'text', label: '内容', ph: '表示された文字' }, { key: 'font', label: 'フォント', ph: '例：けいふぉんと' },
      { key: 'size', label: 'サイズ', ph: '例：大／画面幅の8割' }, { key: 'color', label: '色・縁', ph: '例：白文字＋黒縁' },
      { key: 'pos', label: '位置', ph: '上／中央／下', list: 'telop-pos' }, { key: 'memo', label: 'メモ', ph: '動き・出方など' }],
    lists: [datalist('telop-pos', TELOP_POS)],
    make: function () { return { t: Number(EditUI.curT) || 0, text: '', font: '', size: '', color: '', pos: '', memo: '' }; }
  }));
  right.appendChild(rowsBox({
    id: 'box-ses', key: 'ses', title: 'SE（効果音）', rowClass: 'se-row', addId: 'add-se', addLabel: '＋ SEを追加',
    emptyHint: 'どこでどんな音が鳴ったかを記録します。',
    cols: [{ key: 'kind', label: '種類', ph: '例：ドン', list: 'se-kinds' }, { key: 'memo', label: 'メモ', ph: '使いどころ・音量など' }],
    lists: [datalist('se-kinds', SE_KINDS)],
    make: function () { return { t: Number(EditUI.curT) || 0, kind: '', memo: '' }; }
  }));
  right.appendChild(memosBox());

  el.appendChild(h('div', { class: 'toolbar' },
    h('button', { class: 'btn ghost', onclick: function () { editSaveNow(); App.go('list'); } }, '← 一覧へ'),
    h('h2', { class: 'page', text: S.title || '無題のショート' })));
  el.appendChild(h('div', { class: 'edit-grid' }, left, right));
  editRefreshDerived();
}

function createShort(kind) {
  var s = newShort(kind);
  return App.save(s).then(function (n) { App.go('edit', n.id); });
}
window.renderEdit = renderEdit;
