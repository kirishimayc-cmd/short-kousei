// ===== ui/library.js : メモ一覧（全ショートの SE・テロップ・カット・スクショメモ・自由メモを項目別に）=====
var LibraryUI = { section: 'ses', kind: 'all', owned: 'all', q: '', open: {} };

var LIB_SECTIONS = [
  ['ses', 'SE', '種類'], ['telops', 'テロップ', 'フォント'], ['cuts', 'カット', '種類'],
  ['notes', 'スクショメモ', '項目'], ['memos', '自由メモ', '見出し']
];
var LIB_FIELDS = {
  ses: [['scene', '使いどころ'], ['effect', '効果'], ['owned', '手持ち'], ['memo', 'メモ']],
  telops: [['text', '内容'], ['size', 'サイズ'], ['color', '色・縁'], ['pos', '位置'], ['memo', 'メモ']],
  cuts: [['memo', 'メモ']],
  notes: [['body', 'メモ']],
  memos: [['body', '内容']]
};

function libItemText(it) {
  return Object.keys(it).map(function (k) { return typeof it[k] === 'string' && k !== 'img' ? it[k] : ''; }).join(' ').toLowerCase();
}

function renderLibrary(el) {
  var body = h('div');
  function draw() {
    body.innerHTML = '';
    var shorts = App.state.shorts.filter(function (s) { return LibraryUI.kind === 'all' || s.kind === LibraryUI.kind; });
    var q = LibraryUI.q.trim().toLowerCase();
    var groups = library(LibraryUI.section, shorts).map(function (g) {
      var items = g.items.filter(function (it) {
        if (LibraryUI.section === 'ses' && LibraryUI.owned !== 'all') {
          if (LibraryUI.owned === 'no' && it.owned !== '持ってない') return false;
          if (LibraryUI.owned === 'yes' && it.owned !== '持ってる') return false;
        }
        return !q || g.key.toLowerCase().indexOf(q) >= 0 || libItemText(it).indexOf(q) >= 0;
      });
      return Object.assign({}, g, { items: items });
    }).filter(function (g) { return g.items.length; });
    var secLabel = LIB_SECTIONS.filter(function (x) { return x[0] === LibraryUI.section; })[0];
    if (!groups.length) {
      body.appendChild(h('div', { class: 'empty', text: 'まだ' + secLabel[1] + 'のメモがありません。編集画面で入力すると、ここに' + secLabel[2] + 'ごとに集まります。' }));
      return;
    }
    groups.forEach(function (g) {
      var det = h('details', { class: 'lib-group', open: LibraryUI.open[LibraryUI.section + '|' + g.key] !== false });
      det.addEventListener('toggle', function () { LibraryUI.open[LibraryUI.section + '|' + g.key] = det.open; });
      det.appendChild(h('summary', null, h('span', { text: g.key }), h('span', { class: 'lib-count', text: String(g.items.length) }),
        h('span', { class: 'lib-meta num', text: g.shortCount + '本で使用・平均再生 ' + fmtNum(g.avgViews) })));
      var list = h('div', { class: 'lib-items' });
      g.items.slice().sort(function (a, b) { return b.views - a.views; }).forEach(function (it) {
        var sh = it.img || (function () {
          var s = App.find(it.shortId);
          var x = s && (s.shots || []).filter(function (p) { return Math.abs((Number(p.t) || 0) - (Number(it.t) || 0)) < 0.05; })[0];
          return x && x.img;
        })();
        var fields = h('div', { class: 'lib-fields' });
        (LIB_FIELDS[LibraryUI.section] || []).forEach(function (f) {
          var v = it[f[0]];
          if (!v) return;
          fields.appendChild(h('span', { class: f[0] === 'owned' ? (v === '持ってない' ? 'owned-no' : 'owned-yes') : '' }, h('b', { text: f[1] }), v));
        });
        if (!fields.childNodes.length) fields.appendChild(h('span', { class: 'hint', style: { margin: 0 }, text: '（メモなし）' }));
        list.appendChild(h('div', { class: 'lib-item' },
          sh ? h('img', { src: sh, alt: '', onclick: function () { showOverlay(sh); } }) : h('div', { class: 'ph', text: '♪' }),
          h('div', null, fields, h('div', { class: 'hint', style: { margin: '3px 0 0' } },
            h('span', { class: 'badge ' + it.kind, text: KIND_LABELS[it.kind] }), ' ', it.title, (it.t != null && LibraryUI.section !== 'memos') ? '・' + it.t + '秒' : '', '・再生 ' + fmtNum(it.views))),
          h('span', { class: 'lib-src', onclick: function () { if (it.t != null) EditUI.curT = Number(it.t) || 0; App.go('edit', it.shortId); setTimeout(function () { var ti = document.getElementById('cur-t'); if (ti) ti.value = EditUI.curT; }, 0); } }, '開く')));
      });
      det.appendChild(list);
      body.appendChild(det);
    });
  }
  var ownedSeg = segControl('lib-owned', [['all', '全部'], ['no', '持ってないSE'], ['yes', '持ってるSE']], LibraryUI.owned, function (k) {
    LibraryUI.owned = k;
    ownedSeg.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.dataset.kind === k); });
    draw();
  });
  ownedSeg.classList.toggle('hidden', LibraryUI.section !== 'ses');
  var section = segControl('lib-section', LIB_SECTIONS.map(function (x) { return [x[0], x[1]]; }), LibraryUI.section, function (k) {
    LibraryUI.section = k;
    section.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.dataset.kind === k); });
    ownedSeg.classList.toggle('hidden', k !== 'ses');
    draw();
  });
  var kind = segControl('lib-kind', [['all', 'すべて'], ['research', '研究'], ['plan', '企画'], ['posted', '自分の投稿']], LibraryUI.kind, function (k) {
    LibraryUI.kind = k;
    kind.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.dataset.kind === k); });
    draw();
  });
  el.appendChild(h('div', { class: 'toolbar' }, h('h2', { class: 'page', text: 'メモ一覧' }), section));
  el.appendChild(h('div', { class: 'toolbar' }, kind, ownedSeg,
    h('input', { type: 'search', id: 'lib-search', placeholder: 'キーワードで絞り込み', value: LibraryUI.q, style: { width: '200px' }, oninput: function (e) { LibraryUI.q = e.target.value; draw(); } })));
  el.appendChild(body);
  draw();
}
window.renderLibrary = renderLibrary;
