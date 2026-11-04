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
  EditUI.saveTimer = null;
  if (!EditUI.draft || !App.find(EditUI.draft.id)) return Promise.resolve();
  return App.save(EditUI.draft).catch(function () {});
}
function editDiscardDraft() { clearTimeout(EditUI.saveTimer); EditUI.draft = null; }
function editFlushIfPending() { if (EditUI.draft && EditUI.saveTimer) editSaveNow(); }
window.addEventListener('beforeunload', editFlushIfPending);
window.addEventListener('pagehide', editFlushIfPending);
document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') editFlushIfPending(); });

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
    var ex = opt.extra && opt.extra(); if (ex) box.appendChild(ex);
    if (list.length) {
      var tb = h('tbody');
      list.forEach(function (r, i) {
        var tr = h('tr', { class: opt.rowClass });
        tr.appendChild(h('td', null, inp('number', r.t, function (v) { r.t = v; }, { class: 't r-t', step: '0.1', min: '0', title: '秒' })));
        if (opt.rowExtra) tr.appendChild(h('td', { class: 'thumb-cell' }, opt.rowExtra(r)));
        opt.cols.forEach(function (c) {
          tr.appendChild(h('td', null, inp('text', r[c.key], function (v) { r[c.key] = v; },
            { class: 'r-' + c.key, placeholder: c.ph || '', list: c.list || null })));
        });
        tr.appendChild(h('td', { class: 'x' }, h('button', { class: 'xbtn', title: '削除', onclick: function () { list.splice(i, 1); editScheduleSave(); draw(); } }, '×')));
        tb.appendChild(tr);
      });
      box.appendChild(h('table', { class: 'rows' },
        h('thead', null, h('tr', null, h('th', { text: '秒' }), opt.rowExtra ? h('th') : null, opt.cols.map(function (c) { return h('th', { text: c.label }); }), h('th'))), tb));
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
    field('URL', inp('url', S.url, function (v) { S.url = v; }, { id: 'f-url', placeholder: 'https://youtube.com/shorts/...', onchange: function () {
      var old = document.querySelector('.player-box'); if (old) old.replaceWith(playerBox());
    } })),
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
  function setT(v) { setCurT(v, false); }
  var ti = h('input', { type: 'number', id: 'cur-t', step: '0.1', min: '0', value: EditUI.curT, oninput: function (e) { EditUI.curT = Number(e.target.value) || 0; },
    onchange: function (e) { setCurT(Number(e.target.value) || 0, false); } });
  function nudge(d) { return h('button', { class: 'btn small' + (Math.abs(d) === 1 ? ' wide-only' : ''), onclick: function () { setT((Number(EditUI.curT) || 0) + d); } }, (d > 0 ? '+' : '') + d); }
  return h('div', { class: 'timebar' },
    h('span', { class: 'lbl wide-only', text: '今の秒数' }), ti, h('span', { class: 'lbl', text: '秒' }),
    nudge(-1), nudge(-0.5), nudge(0.5), nudge(1),
    h('span', { class: 'spacer' }),
    h('label', { class: 'cut-shot-toggle', title: 'カットを押したら動画を2秒止めて、また再生する（スクショを撮る時間）' },
      h('input', { type: 'checkbox', id: 'cut-pause', checked: App.state.prefs.cutPause !== false, onchange: function (e) { App.state.prefs.cutPause = e.target.checked; App.savePrefs(); } }),
      '2秒停止'),
    canShareScreen() ? h('label', { class: 'cut-shot-toggle', title: 'カットを押した時に、同時にスクショも撮る（画面共有中のみ）' },
      h('input', { type: 'checkbox', id: 'cut-shot', checked: !!App.state.prefs.cutShot, onchange: function (e) { App.state.prefs.cutShot = e.target.checked; App.savePrefs(); } }),
      '📸連動') : null,
    h('button', { class: 'btn primary', id: 'add-cut', title: '今の秒数でカットを追加', onclick: function () {
      var t = Number(EditUI.curT) || 0;
      EditUI.draft.cuts.push({ t: t, memo: '' });
      editScheduleSave();
      redrawCuts();
      editRefreshDerived();
      pauseForCut();
      if (canShareScreen() && App.state.prefs.cutShot) {
        if (!isSharing()) { toast('📸連動を使うには、先に「📸 画面共有を開始」を押してください', true); return; }
        captureShotAt(t).then(function () { redrawCuts(); });
      }
    } }, '✂ カット＋'));
}

function canShareScreen() { return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia); }
function redrawCuts() { var cb = document.getElementById('box-cuts'); if (cb && cb.redraw) cb.redraw(); }
function shotNear(t) {
  return (EditUI.draft.shots || []).filter(function (sh) { return Math.abs((Number(sh.t) || 0) - t) < 0.05; })[0] || null;
}

function captureShotAt(t) {
  return grabFrame(document.getElementById('player-frame')).then(function (img) {
    var S = EditUI.draft; if (!S) return;
    S.shots.push({ id: uid(), img: img, t: t, notes: [] });
    editScheduleSave();
    var b = document.getElementById('box-shots'); if (b && b.redraw) b.redraw();
  }).catch(function (e) { toast(e.message, true); refreshShareUI(); });
}

// カットを押したら2秒止めて再生再開（スマホでスクショを撮る時間）
function pauseForCut() {
  if (App.state.prefs.cutPause === false) return;
  var y = Player.yt;
  if (!y || !y.getPlayerState || !y.pauseVideo) return;
  var playing = y.getPlayerState() === 1;
  if (!playing && !Player.pauseTimer) return;   // 元から止まっていたら何もしない
  if (playing) y.pauseVideo();
  clearTimeout(Player.pauseTimer);
  var st = document.getElementById('player-state');
  if (st) st.textContent = '⏸ 2秒停止中（今のうちにスクショ）';
  Player.pauseTimer = setTimeout(function () {
    Player.pauseTimer = null;
    if (Player.yt === y) { try { y.playVideo(); } catch (e) { /* noop */ } }
    var st2 = document.getElementById('player-state');
    if (st2) st2.textContent = '再生中の秒数が「今の秒数」に自動で入ります';
  }, 2000);
}

function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function shootAllCuts(btn) {
  if (!isSharing()) { toast('先に「📸 画面共有を開始」を押してください', true); return; }
  if (!Player.yt || !Player.yt.seekTo) { toast('まとめて撮影はYouTubeの動画で使えます', true); return; }
  var S = EditUI.draft;
  var todo = S.cuts.map(function (c) { return Number(c.t) || 0; }).filter(function (t) { return !shotNear(t); });
  if (!todo.length) { toast('すべてのカットにスクショがあります'); return; }
  btn.disabled = true;
  var done = 0;
  try { Player.yt.pauseVideo(); } catch (e) { /* noop */ }
  todo.reduce(function (pr, t) {
    return pr.then(function () {
      if (EditUI.draft !== S || !isSharing()) throw new Error('stop');
      btn.textContent = '撮影中… ' + (done + 1) + '/' + todo.length;
      Player.yt.seekTo(Math.round((t + 0.15) * 100) / 100, true);
      return wait(800).then(function () { return captureShotAt(t); }).then(function () { done++; });
    });
  }, Promise.resolve()).catch(function () { /* 中断 */ }).then(function () {
    btn.disabled = false; btn.textContent = '📸 カット位置をまとめて撮影';
    redrawCuts();
    toast(done + '枚撮影しました');
  });
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
  if (!EditUI.draft || EditUI.draft.id !== s.id) { editSaveNow(); EditUI.curT = 0; EditUI.draft = JSON.parse(JSON.stringify(s)); }
  var S = EditUI.draft;

  var left = h('div', { class: 'sticky-col' });
  if (window.playerBox) left.appendChild(playerBox());
  left.appendChild(infoBox());

  var right = h('div', { class: 'edit-main' });
  right.appendChild(blocksBox());
  if (window.shotsBox) right.appendChild(shotsBox());
  right.appendChild(rowsBox({
    id: 'box-cuts', key: 'cuts', title: 'カット', rowClass: 'cut-row', addId: 'add-cut-row', addLabel: '＋ 行を追加',
    badge: function () { return h('span', { class: 'count', id: 'cut-count', text: String(S.cuts.length) }); },
    sub: '「✂ カット＋」で今の秒数を記録', emptyHint: '動画を見ながら、画面が切り替わるたびに「✂ カット＋」を押してください。',
    cols: [{ key: 'memo', label: 'カットのメモ', ph: '例：引き→寄り、ジャンプカット' }],
    rowExtra: function (r) {
      var sh = shotNear(Number(r.t) || 0);
      return sh ? h('img', { class: 'cut-thumb', src: sh.img, alt: '', onclick: function () { showOverlay(sh.img); } }) : null;
    },
    extra: function () {
      return canShareScreen() ? h('div', { class: 'row', style: { marginBottom: '8px' } },
        h('button', { class: 'btn small', id: 'shoot-cuts', onclick: function (e) { shootAllCuts(e.currentTarget); } }, '📸 カット位置をまとめて撮影'),
        h('span', { class: 'hint', style: { margin: 0 }, text: 'スクショが無いカットの位置へ自動で移動して撮ります（YouTube・画面共有中）' })) : null;
    },
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

// ---- 動画の小窓とスクショ ----
function refreshShareUI() {
  var on = isSharing();
  var st = document.getElementById('share-state');
  if (st) { st.className = 'share-state' + (on ? ' on' : ''); st.textContent = on ? '● 画面共有中 — 📸で今のコマを保存' : (Capture.wasSharing ? '共有が止まりました' : '未共有'); }
  var b = document.getElementById('shot-btn');
  if (b) b.textContent = on ? '📸 スクショ' : (Capture.wasSharing ? '📸 共有をやり直す' : '📸 画面共有を開始');
  var sb = document.getElementById('stop-share'); if (sb) sb.classList.toggle('hidden', !on);
}
onShareEnded(function () { refreshShareUI(); });

// ---- ツール内の動画プレーヤー ----
var Player = { yt: null, ytReady: false, ytQueue: [], poll: null, site: null };

function loadYouTubeAPI(cb) {
  if (window.YT && window.YT.Player) return cb();
  Player.ytQueue.push(cb);
  if (document.getElementById('yt-api')) return;
  var prev = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = function () { if (prev) prev(); Player.ytQueue.splice(0).forEach(function (f) { f(); }); };
  var sc = document.createElement('script');
  sc.id = 'yt-api'; sc.src = 'https://www.youtube.com/iframe_api';
  sc.onerror = function () { var st = document.getElementById('player-state'); if (st) st.textContent = 'YouTubeの再生部品を読み込めませんでした（ネット接続を確認してください）'; };
  document.head.appendChild(sc);
}

function destroyPlayer() {
  clearInterval(Player.poll); Player.poll = null;
  clearTimeout(Player.pauseTimer); Player.pauseTimer = null;
  if (Player.yt && Player.yt.destroy) { try { Player.yt.destroy(); } catch (e) { /* noop */ } }
  Player.yt = null; Player.site = null;
}

function setCurT(v, fromPlayer) {
  EditUI.curT = Math.max(0, Math.round(v * 10) / 10);
  var ti = document.getElementById('cur-t');
  if (ti && (fromPlayer ? document.activeElement !== ti : true)) ti.value = EditUI.curT;
  if (!fromPlayer && Player.yt && Player.yt.seekTo) { try { Player.yt.seekTo(EditUI.curT, true); } catch (e) { /* noop */ } }
}

function mountPlayer(frame, p) {
  destroyPlayer();
  Player.site = p.site;
  if (p.site === 'youtube') {
    var holder = h('div', { id: 'yt-holder' });
    frame.appendChild(holder);
    loadYouTubeAPI(function () {
      if (!document.body.contains(holder)) return;
      Player.yt = new YT.Player(holder, {
        videoId: p.id, width: '100%', height: '100%',
        playerVars: { playsinline: 1, rel: 0, loop: 1, playlist: p.id, modestbranding: 1, origin: location.origin },
        events: {
          onReady: function () { var st = document.getElementById('player-state'); if (st) st.textContent = '再生中の秒数が「今の秒数」に自動で入ります'; },
          onError: function (e) {
            var st = document.getElementById('player-state');
            if (st) st.textContent = (e.data === 101 || e.data === 150) ? 'この動画は投稿者が埋め込み再生を許可していません。下のリンクから元のページで見てください' : '再生エラー（' + e.data + '）。下のリンクから元のページで見てください';
          }
        }
      });
      clearInterval(Player.poll);
      Player.poll = setInterval(function () {
        var y = Player.yt;
        if (!y || !y.getPlayerState || !document.body.contains(frame)) return;
        if (y.getPlayerState() === 1) setCurT(y.getCurrentTime(), true);
      }, 200);
    });
  } else {
    frame.appendChild(h('iframe', { src: p.url, allow: 'autoplay; encrypted-media; picture-in-picture', allowfullscreen: true, referrerpolicy: 'strict-origin-when-cross-origin' }));
  }
}

function playerBox() {
  var S = EditUI.draft;
  var p = playerUrl(S.url);
  var canShare = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  var box = h('div', { class: 'box player-box' }, h('h3', { class: 'player-title' }, '動画を見る・撮る'));
  if (p && p.site !== 'other') {
    var frame = h('div', { id: 'player-frame', class: 'player-frame', 'data-site': p.site });
    box.appendChild(frame);
    setTimeout(function () { mountPlayer(frame, p); }, 0);
    box.appendChild(h('div', { id: 'player-state', class: 'share-state', text: location.protocol === 'file:' ? 'ファイルから開いているとYouTubeは再生できません（エラー153）。公開URLから開いてください' : '読み込み中…' }));
  } else {
    destroyPlayer();
    box.appendChild(h('p', { class: 'hint', text: S.url ? 'このURLはツール内で再生できません（YouTube・TikTok・Instagramに対応）' : '基本情報にURLを貼ると、ここで再生できます' }));
  }
  box.appendChild(timeBar());
  if (S.url && p) box.appendChild(h('a', { id: 'player-fallback', class: 'hint', href: /^https?:/i.test(S.url) ? S.url : 'https://' + S.url, target: '_blank', rel: 'noopener', text: '元のページで開く ↗' }));
  var fileIn = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, onchange: function () { addImageFiles(fileIn.files); fileIn.value = ''; } });
  box.appendChild(h('div', { class: 'row', style: { marginTop: '10px' } },
    canShare ? h('button', { class: 'btn primary shot-btn', id: 'shot-btn', onclick: takeShot }, '📸') : null,
    h('button', { class: 'btn', id: 'add-images', onclick: function () { fileIn.click(); } }, '🖼 画像を追加'),
    canShare ? h('button', { class: 'btn small ghost hidden', id: 'stop-share', onclick: function () { stopShare(); refreshShareUI(); } }, '共有を止める') : null,
    fileIn));
  if (canShare) box.appendChild(h('div', { id: 'share-state', class: 'share-state' }));
  box.appendChild(h('p', { class: 'hint', text: canShare
    ? '📸：初回だけ共有の確認で「このタブ」を選ぶと、以降はワンタップで動画の部分だけを保存します。スクショを Ctrl+V で貼り付けることもできます。'
    : 'スクショは本体で撮って（サイドボタン＋音量上げ）、「画像を追加」から取り込んでください。複数まとめて選べます。' }));
  return box;
}

function addImageFiles(files) {
  var list = Array.prototype.filter.call(files || [], function (f) { return /^image\//.test(f.type); });
  if (!list.length || !EditUI.draft) return Promise.resolve();
  var t = Number(EditUI.curT) || 0;
  return Promise.all(list.map(imageFileToJpeg)).then(function (imgs) {
    var S = EditUI.draft; if (!S) return;
    imgs.forEach(function (img) { S.shots.push({ id: uid(), img: img, t: t, notes: [] }); });
    editScheduleSave();
    var b = document.getElementById('box-shots'); if (b && b.redraw) b.redraw();
    toast('画像を' + imgs.length + '枚追加しました（' + t + '秒）');
  }).catch(function (e) { toast(e.message, true); });
}

document.addEventListener('paste', function (e) {
  if (App.tab !== 'edit' || !EditUI.draft || !e.clipboardData) return;
  var files = Array.prototype.slice.call(e.clipboardData.files || []);
  if (!files.length) return;
  e.preventDefault();
  addImageFiles(files);
});

function takeShot() {
  if (!isSharing()) {
    startShare().then(function () { Capture.wasSharing = true; refreshShareUI(); toast('共有を開始しました。もう一度📸で撮影できます'); })
      .catch(function (e) { if (e && e.name !== 'NotAllowedError') toast('画面共有を開始できませんでした: ' + e.message, true); refreshShareUI(); });
    return;
  }
  grabFrame(document.getElementById('player-frame')).then(function (img) {
    var S = EditUI.draft;
    if (!S) return;
    S.shots.push({ id: uid(), img: img, t: Number(EditUI.curT) || 0, notes: [] });
    editScheduleSave();
    var b = document.getElementById('box-shots'); if (b && b.redraw) b.redraw();
    toast('スクショを保存しました（' + (Number(EditUI.curT) || 0) + '秒）');
  }).catch(function (e) { toast(e.message, true); refreshShareUI(); });
}

function showOverlay(src) {
  var o = document.getElementById('overlay');
  o.innerHTML = '';
  o.appendChild(h('img', { src: src }));
  o.classList.remove('hidden');
  o.onclick = function () { o.classList.add('hidden'); o.innerHTML = ''; };
}
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { var o = document.getElementById('overlay'); if (o) o.click(); } });

function shotsBox() {
  var S = EditUI.draft;
  var box = h('div', { class: 'box', id: 'box-shots' });
  function draw() {
    box.innerHTML = '';
    S.shots.sort(function (a, b) { return (Number(a.t) || 0) - (Number(b.t) || 0); });
    box.appendChild(h('h3', null, 'スクショ', h('span', { class: 'count', text: String(S.shots.length) }), h('span', { class: 'sub', text: '1枚ごとにメモをいくつでも' })));
    if (!S.shots.length) { box.appendChild(h('p', { class: 'hint', text: '左の「📸」で、動画の今のコマを保存できます。' })); }
    var grid = h('div', { class: 'shots' });
    S.shots.forEach(function (sh, i) {
      var notes = h('div');
      sh.notes = sh.notes || [];
      sh.notes.forEach(function (n, j) {
        notes.appendChild(h('div', { class: 'note' },
          inp('text', n.label, function (v) { n.label = v; }, { class: 'n-label', list: 'note-labels', placeholder: '項目' }),
          h('span'),
          h('button', { class: 'xbtn', title: 'メモを削除', onclick: function () { sh.notes.splice(j, 1); editScheduleSave(); draw(); } }, '×'),
          h('textarea', { placeholder: 'メモ', oninput: function (e) { n.body = e.target.value; editScheduleSave(); } }, n.body || '')));
      });
      grid.appendChild(h('div', { class: 'shot' },
        h('img', { src: sh.img, alt: 'スクショ ' + sh.t + '秒', onclick: function () { showOverlay(sh.img); } }),
        h('div', { class: 'shot-body' },
          h('div', { class: 'row', style: { flexWrap: 'nowrap' } },
            inp('number', sh.t, function (v) { sh.t = v; }, { class: 't s-t', step: '0.1', min: '0', style: { width: '70px', textAlign: 'right' } }),
            h('span', { class: 'hint', style: { margin: 0 }, text: '秒' }), h('span', { class: 'spacer' }),
            h('button', { class: 'btn small ghost del-shot', onclick: function () { if (confirm('このスクショを削除しますか？')) { S.shots.splice(i, 1); editScheduleSave(); draw(); } } }, '削除')),
          notes,
          h('button', { class: 'btn small add-note', onclick: function () { sh.notes.push({ label: NOTE_LABELS[sh.notes.length % NOTE_LABELS.length], body: '' }); editScheduleSave(); draw(); } }, '＋ メモ'))));
    });
    box.appendChild(grid);
    box.appendChild(datalist('note-labels', NOTE_LABELS));
  }
  draw();
  box.redraw = draw;
  setTimeout(refreshShareUI, 0);
  return box;
}
