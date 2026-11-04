// ===== ui/band.js : 構成の帯グラフ =====
function renderBand(s, opts) {
  opts = opts || {};
  var d = Number(s.duration) || 0;
  if (d <= 0) return h('div', { class: 'band empty-band', text: '尺未入力' });
  if (!(s.blocks || []).length && !(s.cuts || []).length) return h('div', { class: 'band empty-band', text: '構成未入力' });
  var band = h('div', { class: 'band' });
  (s.blocks || []).forEach(function (b) {
    var l = Math.max(0, Math.min(100, b.start / d * 100));
    var w = Math.max(0, Math.min(100 - l, (b.end - b.start) / d * 100));
    band.appendChild(h('div', {
      class: 'seg-b', title: b.type + ' ' + b.start + '〜' + b.end + '秒' + (b.memo ? '\n' + b.memo : ''),
      style: { left: l + '%', width: w + '%', background: App.blockColor(b.type) }
    }, w > 7 ? b.type : ''));
  });
  if (opts.cuts !== false) (s.cuts || []).forEach(function (c) {
    if (c.t >= 0 && c.t <= d) band.appendChild(h('div', { class: 'cut-tick', title: 'カット ' + c.t + '秒', style: { left: 'calc(' + (c.t / d * 100) + '% - 1px)' } }));
  });
  if (!opts.scale) return band;
  return h('div', null, band, h('div', { class: 'band-scale' }, h('span', { text: '0秒' }), h('span', { text: (d / 2) + '秒' }), h('span', { text: d + '秒' })));
}
