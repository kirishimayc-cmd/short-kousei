// ===== analysis.js : 指標計算 =====
function firstBlock(s, type) {
  var bs = (s.blocks || []).filter(function (b) { return b.type === type; });
  bs.sort(function (a, b) { return a.start - b.start; });
  return bs[0] || null;
}

function metrics(s) {
  var d = Number(s.duration) || 0;
  var hook = firstBlock(s, 'フック');
  var punch = firstBlock(s, 'オチ');
  var cutCount = (s.cuts || []).length;
  return {
    hookSec: hook ? Math.round((hook.end - hook.start) * 10) / 10 : null,
    punchPct: punch && d > 0 ? Math.round(punch.start / d * 100) : null,
    hasCTA: !!firstBlock(s, 'CTA'),
    cutCount: cutCount,
    avgCutSec: d > 0 ? Math.round(d / (cutCount + 1) * 10) / 10 : null
  };
}

function templateStats(templateId, shorts) {
  var ps = (shorts || []).filter(function (s) { return s.kind === 'posted' && s.templateId === templateId; });
  if (!ps.length) return { count: 0, avgViews: null };
  var sum = ps.reduce(function (a, s) { return a + (Number(s.views) || 0); }, 0);
  return { count: ps.length, avgViews: Math.round(sum / ps.length) };
}

// 全ショートの SE・テロップ・カット・スクショメモ・自由メモを、項目ごとにまとめる
var LIBRARY_KEYS = {
  ses: function (r) { return r.kind; },
  telops: function (r) { return r.font; },
  cuts: function (r) { return r.type; },
  notes: function (r) { return r.label; },
  memos: function (r) { return r.title; }
};
function library(section, shorts) {
  var keyOf = LIBRARY_KEYS[section];
  var groups = {};
  (shorts || []).forEach(function (s) {
    var rows = [];
    if (section === 'notes') (s.shots || []).forEach(function (sh) { (sh.notes || []).forEach(function (n) { rows.push(Object.assign({ t: sh.t, img: sh.img }, n)); }); });
    else rows = s[section] || [];
    rows.forEach(function (r) {
      var key = String(keyOf(r) || '').trim() || '（未入力）';
      var g = groups[key] || (groups[key] = { key: key, items: [], ids: {} });
      g.items.push(Object.assign({}, r, { shortId: s.id, title: s.title || '無題', kind: s.kind, views: Number(s.views) || 0, rowKind: r.kind }));
      g.ids[s.id] = Number(s.views) || 0;
    });
  });
  return Object.keys(groups).map(function (k) {
    var g = groups[k], vs = Object.keys(g.ids).map(function (id) { return g.ids[id]; });
    return { key: g.key, items: g.items, shortCount: vs.length,
      avgViews: vs.length ? Math.round(vs.reduce(function (a, b) { return a + b; }, 0) / vs.length) : null };
  }).sort(function (a, b) {
    if ((a.key === '（未入力）') !== (b.key === '（未入力）')) return a.key === '（未入力）' ? 1 : -1;
    return b.items.length - a.items.length || String(a.key).localeCompare(String(b.key), 'ja');
  });
}

if (typeof module !== 'undefined') module.exports = { metrics: metrics, templateStats: templateStats, library: library };
