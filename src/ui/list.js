// ===== ui/list.js : 一覧 =====
var ListUI = { kind: 'all', q: '', sort: 'createdAt' };

function shortText(s) {
  var parts = [s.title, s.channel, s.url].concat(s.tags || []);
  (s.memos || []).forEach(function (m) { parts.push(m.title, m.body); });
  (s.blocks || []).forEach(function (b) { parts.push(b.memo); });
  (s.cuts || []).forEach(function (c) { parts.push(c.memo); });
  (s.telops || []).forEach(function (t) { parts.push(t.text, t.font, t.memo); });
  (s.ses || []).forEach(function (x) { parts.push(x.kind, x.memo); });
  (s.shots || []).forEach(function (sh) { (sh.notes || []).forEach(function (n) { parts.push(n.label, n.body); }); });
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function sortShorts(arr, key) {
  var f = {
    views: function (a, b) { return (b.views || 0) - (a.views || 0); },
    postedAt: function (a, b) { return String(b.postedAt || '').localeCompare(String(a.postedAt || '')); },
    createdAt: function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); }
  }[key];
  return arr.slice().sort(f);
}

function segControl(id, items, cur, onpick) {
  return h('div', { class: 'seg', id: id }, items.map(function (it) {
    return h('button', { 'data-kind': it[0], class: it[0] === cur ? 'on' : '', onclick: function () { onpick(it[0]); } }, it[1]);
  }));
}

function renderList(el) {
  var all = App.state.shorts;
  var cardsWrap = h('div');
  function drawCards() {
    cardsWrap.innerHTML = '';
    var q = ListUI.q.trim().toLowerCase();
    var arr = all.filter(function (s) {
      return (ListUI.kind === 'all' || s.kind === ListUI.kind) && (!q || shortText(s).indexOf(q) >= 0);
    });
    arr = sortShorts(arr, ListUI.sort);
    if (!all.length) {
      cardsWrap.appendChild(h('div', { class: 'empty' },
        h('div', { text: 'まだショートがありません。' }),
        h('div', { text: '「いいな」と思った他所のショートは「＋研究」、自分のアイデアは「＋企画」から。' })));
      return;
    }
    if (!arr.length) { cardsWrap.appendChild(h('div', { class: 'empty', text: '条件に合うショートがありません' })); return; }
    var grid = h('div', { class: 'cards' });
    arr.forEach(function (s) {
      var shot = (s.shots || [])[0];
      var m = metrics(s);
      grid.appendChild(h('div', { class: 'card', onclick: function () { App.go('edit', s.id); } },
        h('div', { class: 'thumb', style: shot ? { backgroundImage: 'url(' + shot.img + ')' } : null }, shot ? '' : '▶'),
        h('div', { class: 'body' },
          h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'badge ' + s.kind, text: KIND_LABELS[s.kind] }),
            s.channel ? h('span', { class: 'hint', style: { margin: 0 }, text: s.channel }) : null),
          h('div', { class: 'title', text: s.title || '無題のショート' }),
          h('div', { class: 'meta num' },
            h('span', { text: '再生 ' + fmtNum(s.views) }),
            h('span', { text: '✂ ' + m.cutCount }),
            h('span', { text: s.duration ? s.duration + '秒' : '尺—' }),
            (s.shots || []).length ? h('span', { text: '📸 ' + s.shots.length }) : null),
          renderBand(s),
          (s.tags || []).length ? h('div', { class: 'tags' }, s.tags.map(function (t) { return h('span', { class: 'tag', text: t }); })) : null)));
    });
    cardsWrap.appendChild(grid);
  }
  var filter = segControl('kind-filter', [['all', 'すべて'], ['research', '研究'], ['plan', '企画'], ['posted', '自分の投稿']], ListUI.kind, function (k) {
    ListUI.kind = k;
    filter.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.dataset.kind === k); });
    drawCards();
  });
  var search = h('input', { type: 'search', id: 'search', placeholder: 'タイトル・タグ・メモで検索', value: ListUI.q, style: { width: '220px' },
    oninput: function (e) { ListUI.q = e.target.value; drawCards(); } });
  var sort = h('select', { id: 'sort', onchange: function (e) { ListUI.sort = e.target.value; drawCards(); } },
    [['createdAt', '登録が新しい順'], ['views', '再生数が多い順'], ['postedAt', '投稿日が新しい順']].map(function (o) {
      return h('option', { value: o[0], text: o[1], selected: o[0] === ListUI.sort });
    }));
  el.appendChild(h('div', { class: 'toolbar' },
    h('h2', { class: 'page', text: 'ショート一覧' }), filter, search, sort, h('span', { class: 'spacer' }),
    h('button', { class: 'btn primary', id: 'new-research', onclick: function () { createShort('research'); } }, '＋ 研究'),
    h('button', { class: 'btn', id: 'new-plan', onclick: function () { createShort('plan'); } }, '＋ 企画')));
  el.appendChild(cardsWrap);
  drawCards();
}
window.renderList = renderList;
