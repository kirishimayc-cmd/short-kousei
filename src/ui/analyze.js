// ===== ui/analyze.js : 分析 =====
var AnalyzeUI = { kind: 'all', sort: 'views' };

function avgOf(arr, f) {
  var v = arr.map(f).filter(function (x) { return x != null && isFinite(x); });
  if (!v.length) return null;
  return Math.round(v.reduce(function (a, b) { return a + b; }, 0) / v.length * 10) / 10;
}

function renderAnalyze(el) {
  var body = h('div');
  function draw() {
    body.innerHTML = '';
    var arr = App.state.shorts.filter(function (s) { return AnalyzeUI.kind === 'all' || s.kind === AnalyzeUI.kind; });
    if (!arr.length) { body.appendChild(h('div', { class: 'empty', text: 'この条件のショートがありません' })); return; }
    var rows = arr.map(function (s) { return { s: s, m: metrics(s) }; });

    // --- 気づきカード（再生数で上位半分と下位半分を比べる）---
    var ranked = rows.filter(function (r) { return r.s.views > 0; }).sort(function (a, b) { return b.s.views - a.s.views; });
    if (ranked.length >= 2) {
      var half = Math.ceil(ranked.length / 2), top = ranked.slice(0, half), low = ranked.slice(half);
      var withCTA = ranked.filter(function (r) { return r.m.hasCTA; }), noCTA = ranked.filter(function (r) { return !r.m.hasCTA; });
      function card(k, a, b, unit, s) {
        return h('div', { class: 'insight' }, h('div', { class: 'k', text: k }),
          h('div', { class: 'v' }, dash(a, unit), h('span', { class: 'hint', style: { fontSize: '13px' }, text: '  vs  ' + dash(b, unit) })),
          h('div', { class: 's', text: s }));
      }
      body.appendChild(h('div', { class: 'insights' },
        card('フックの長さ', avgOf(top, function (r) { return r.m.hookSec; }), avgOf(low, function (r) { return r.m.hookSec; }), '秒', '再生上位' + top.length + '本の平均 vs 下位'),
        card('オチの位置', avgOf(top, function (r) { return r.m.punchPct; }), avgOf(low, function (r) { return r.m.punchPct; }), '%', '尺に対する位置（上位 vs 下位）'),
        card('カット数', avgOf(top, function (r) { return r.m.cutCount; }), avgOf(low, function (r) { return r.m.cutCount; }), '回', '上位 vs 下位'),
        card('平均再生（CTAあり／なし）', withCTA.length ? fmtNum(Math.round(avgOf(withCTA, function (r) { return r.s.views; }))) : null,
          noCTA.length ? fmtNum(Math.round(avgOf(noCTA, function (r) { return r.s.views; }))) : null, '', 'CTAあり' + withCTA.length + '本 vs なし' + noCTA.length + '本')));
    }

    // --- 構成の並び比較 ---
    var byViews = rows.slice().sort(function (a, b) { return (b.s.views || 0) - (a.s.views || 0); });
    var cmp = h('div', { class: 'compare' }, h('h3', { style: { margin: '0 0 8px', fontSize: '14.5px' }, text: '構成の比較（再生数の多い順）' }),
      h('div', { class: 'legend' }, App.state.blockTypes.map(function (bt) { return h('span', null, h('span', { class: 'swatch', style: { background: bt.color } }), bt.name); }),
        h('span', null, h('span', { class: 'swatch', style: { background: '#fff', width: '3px', boxShadow: '0 0 0 1px #9db3d3' } }), 'カット')));
    byViews.slice(0, 40).forEach(function (r) {
      cmp.appendChild(h('div', { class: 'cmp-row' },
        h('div', { class: 't', title: r.s.title, onclick: function () { App.go('edit', r.s.id); }, text: r.s.title || '無題' }),
        h('div', { class: 'v', text: fmtNum(r.s.views) }),
        renderBand(r.s)));
    });
    body.appendChild(cmp);

    // --- 表 ---
    var cols = [
      ['title', 'タイトル', function (r) { return r.s.title || '無題'; }, false],
      ['kind', '種別', function (r) { return KIND_LABELS[r.s.kind]; }, false],
      ['views', '再生数', function (r) { return r.s.views; }, true, fmtNum],
      ['likes', '高評価', function (r) { return r.s.likes; }, true, fmtNum],
      ['comments', 'コメント', function (r) { return r.s.comments; }, true, fmtNum],
      ['duration', '尺', function (r) { return r.s.duration || null; }, true, function (v) { return dash(v, '秒'); }],
      ['hookSec', 'フック', function (r) { return r.m.hookSec; }, true, function (v) { return dash(v, '秒'); }],
      ['punchPct', 'オチ位置', function (r) { return r.m.punchPct; }, true, function (v) { return dash(v, '%'); }],
      ['hasCTA', 'CTA', function (r) { return r.m.hasCTA ? 1 : 0; }, true, function (v) { return v ? 'あり' : 'なし'; }],
      ['cutCount', 'カット数', function (r) { return r.m.cutCount; }, true, String],
      ['avgCutSec', '平均カット', function (r) { return r.m.avgCutSec; }, true, function (v) { return dash(v, '秒'); }]
    ];
    var sc = cols.filter(function (c) { return c[0] === AnalyzeUI.sort; })[0] || cols[2];
    var sorted = rows.slice().sort(function (a, b) {
      var x = sc[2](a), y = sc[2](b);
      if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
      return sc[3] ? y - x : String(x).localeCompare(String(y), 'ja');
    });
    var tb = h('tbody');
    sorted.forEach(function (r) {
      tb.appendChild(h('tr', { style: { cursor: 'pointer' }, onclick: function () { App.go('edit', r.s.id); } }, cols.map(function (c) {
        var v = c[2](r);
        return h('td', { class: c[3] ? 'n' : '', text: c[4] ? c[4](v) : (v == null ? '—' : String(v)) });
      })));
    });
    body.appendChild(h('div', { class: 'table-wrap box', style: { padding: 0 } }, h('table', { class: 'grid' },
      h('thead', null, h('tr', null, cols.map(function (c) {
        return h('th', { class: c[0] === sc[0] ? 'sorted' : '', title: 'クリックで並べ替え', onclick: function () { AnalyzeUI.sort = c[0]; draw(); }, text: c[1] });
      }))), tb)));
  }
  var filter = segControl('an-kind', [['all', 'すべて'], ['research', '研究'], ['plan', '企画'], ['posted', '自分の投稿']], AnalyzeUI.kind, function (k) {
    AnalyzeUI.kind = k;
    filter.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.dataset.kind === k); });
    draw();
  });
  el.appendChild(h('div', { class: 'toolbar' }, h('h2', { class: 'page', text: '分析' }), filter));
  el.appendChild(body);
  draw();
}
window.renderAnalyze = renderAnalyze;
