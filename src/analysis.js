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

if (typeof module !== 'undefined') module.exports = { metrics: metrics, templateStats: templateStats };
