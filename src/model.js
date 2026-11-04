// ===== model.js : データ生成・正規化 =====
var DEFAULT_BLOCK_TYPES = [
  { name: 'フック', color: '#e4572e' },
  { name: '前振り', color: '#f3a712' },
  { name: '展開', color: '#4c9f70' },
  { name: 'オチ', color: '#3d5a80' },
  { name: 'CTA', color: '#9b5de5' }
];
var KIND_LABELS = { research: '研究', plan: '企画', posted: '自分の投稿' };

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function num(v) {
  var n = Number(v);
  return isFinite(n) && v !== '' && v !== null ? n : 0;
}

function newShort(kind) {
  var now = Date.now();
  return {
    id: uid(), kind: kind || 'research', title: '', url: '', channel: '',
    duration: 0, postedAt: '', views: 0, likes: 0, comments: 0, templateId: null,
    tags: [], blocks: [], cuts: [], telops: [], ses: [], shots: [], memos: [],
    createdAt: now, updatedAt: now
  };
}

function byT(a, b) { return a.t - b.t; }

function normalizeShort(s) {
  var o = Object.assign(newShort(s.kind), s);
  ['duration', 'views', 'likes', 'comments'].forEach(function (k) { o[k] = num(o[k]); });
  var d = o.duration;
  o.blocks = (o.blocks || []).map(function (b) {
    var st = num(b.start), en = num(b.end);
    if (st > en) { var x = st; st = en; en = x; }
    if (d > 0) { st = Math.min(Math.max(st, 0), d); en = Math.min(Math.max(en, 0), d); }
    return Object.assign({}, b, { start: st, end: en, memo: b.memo || '' });
  }).sort(function (a, b) { return a.start - b.start; });
  ['cuts', 'telops', 'ses'].forEach(function (k) {
    o[k] = (o[k] || []).map(function (r) { return Object.assign({}, r, { t: num(r.t) }); }).sort(byT);
  });
  o.tags = (o.tags || []).filter(Boolean);
  o.shots = o.shots || [];
  o.memos = o.memos || [];
  return o;
}

function templateFromShort(s, name) {
  var d = num(s.duration);
  return {
    id: uid(), name: name || s.title || '無題の型', sourceId: s.id, duration: d,
    blocks: (s.blocks || []).map(function (b) {
      return {
        type: b.type, start: num(b.start), end: num(b.end), memo: b.memo || '',
        startRatio: d > 0 ? num(b.start) / d : null,
        endRatio: d > 0 ? num(b.end) / d : null
      };
    }),
    notes: { cut: '', telop: '', se: '' },
    createdAt: Date.now()
  };
}

function shortFromTemplate(t, duration) {
  var s = newShort('plan');
  var d = num(duration) > 0 ? num(duration) : num(t.duration);
  s.duration = d;
  s.templateId = t.id;
  s.title = t.name + 'の企画';
  s.blocks = (t.blocks || []).map(function (b) {
    var useRatio = b.startRatio != null && d > 0;
    return {
      type: b.type, memo: b.memo || '',
      start: useRatio ? Math.round(b.startRatio * d * 10) / 10 : num(b.start),
      end: useRatio ? Math.round(b.endRatio * d * 10) / 10 : num(b.end)
    };
  });
  return s;
}

if (typeof module !== 'undefined') module.exports = {
  DEFAULT_BLOCK_TYPES: DEFAULT_BLOCK_TYPES, KIND_LABELS: KIND_LABELS, uid: uid, num: num,
  newShort: newShort, normalizeShort: normalizeShort,
  templateFromShort: templateFromShort, shortFromTemplate: shortFromTemplate
};
