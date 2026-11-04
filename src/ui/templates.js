// ===== ui/templates.js : 型 =====
function renderTemplates(el) {
  var ts = App.state.templates.slice().sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
  el.appendChild(h('div', { class: 'toolbar' }, h('h2', { class: 'page', text: '型' }),
    h('span', { class: 'hint', style: { margin: 0 }, text: '編集画面の「型として保存」で増えます。型から企画を作り、投稿後に数字を入れると平均再生数が出ます。' })));
  if (!ts.length) {
    el.appendChild(h('div', { class: 'empty', text: 'まだ型がありません。伸びたショートを研究したら、編集画面の「型として保存」を押してください。' }));
    return;
  }
  ts.forEach(function (t) {
    var st = templateStats(t.id, App.state.shorts);
    var src = App.find(t.sourceId);
    t.notes = t.notes || { cut: '', telop: '', se: '' };
    var saveTimer;
    function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(function () { App.saveTemplate(t); }, 400); }
    function note(key, label, ph) {
      return h('div', null, h('label', { text: label }),
        h('textarea', { placeholder: ph, oninput: function (e) { t.notes[key] = e.target.value; saveSoon(); } }, t.notes[key] || ''));
    }
    el.appendChild(h('div', { class: 'tpl' },
      h('div', { class: 'head' },
        h('input', { type: 'text', value: t.name, oninput: function (e) { t.name = e.target.value; saveSoon(); } }),
        h('span', { class: 'spacer' }),
        h('div', { class: 'kpis num' },
          h('span', null, 'この型の投稿 ', h('b', { class: 'tpl-count', text: String(st.count) }), '本'),
          h('span', null, '平均再生 ', h('b', { class: 'tpl-avg', text: fmtNum(st.avgViews) })))),
      renderBand({ duration: t.duration, blocks: t.blocks, cuts: [] }, { scale: true }),
      h('div', { class: 'row', style: { marginTop: '8px' } },
        h('span', { class: 'hint', style: { margin: 0 } }, src ? h('a', { href: '#', onclick: function (e) { e.preventDefault(); App.go('edit', src.id); }, text: '元: ' + (src.title || '無題') }) : '元のショートは削除済み'),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn primary use-tpl', onclick: function () {
          var v = prompt('作る企画の尺（秒）', t.duration || '');
          if (v == null) return;
          var s = shortFromTemplate(t, Number(v) || 0);
          App.save(s).then(function (n) { toast('型「' + t.name + '」から企画を作りました'); App.go('edit', n.id); });
        } }, 'この型で企画を作る'),
        h('button', { class: 'btn danger del-tpl', onclick: function () {
          if (!confirm('型「' + t.name + '」を削除しますか？（作った企画は残ります）')) return;
          App.remove('templates', t.id).then(function () { App.render(); });
        } }, '削除')),
      h('div', { class: 'notes3' },
        note('cut', 'カットの傾向', '例：2秒ごとに切り替え'),
        note('telop', 'テロップの傾向', '例：太ゴシック・黄色縁・画面中央'),
        note('se', 'SEの傾向', '例：オチで「ドン」'))));
  });
}
window.renderTemplates = renderTemplates;
