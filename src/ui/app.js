// ===== ui/app.js : 全体の制御 =====
function h(tag, attrs) {
  var el = document.createElement(tag);
  if (attrs) Object.keys(attrs).forEach(function (k) {
    var v = attrs[k];
    if (v == null || v === false) return;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : v);
  });
  for (var i = 2; i < arguments.length; i++) {
    var c = arguments[i];
    (Array.isArray(c) ? c : [c]).forEach(function (x) {
      if (x == null || x === false) return;
      el.appendChild(typeof x === 'string' || typeof x === 'number' ? document.createTextNode(String(x)) : x);
    });
  }
  return el;
}

function toast(msg, isError) {
  var t = h('div', { class: 'toast' + (isError ? ' error' : ''), text: msg });
  document.getElementById('toasts').appendChild(t);
  setTimeout(function () { t.classList.add('out'); }, isError ? 5000 : 2200);
  setTimeout(function () { t.remove(); }, isError ? 5600 : 2800);
}

function fmtNum(n) { return n == null ? '—' : Number(n).toLocaleString('ja-JP'); }
function dash(v, unit) { return v == null ? '—' : v + (unit || ''); }

var App = {
  ready: false,
  tab: 'list',
  currentId: null,
  state: { shorts: [], templates: [], blockTypes: DEFAULT_BLOCK_TYPES.slice() },

  init: function () {
    var self = this;
    document.querySelectorAll('nav [data-tab]').forEach(function (b) {
      b.addEventListener('click', function () { self.go(b.dataset.tab); });
    });
    this.initSettings();
    return this.load().then(function () { self.go('list'); self.ready = true; })
      .catch(function (e) { toast('データを開けませんでした: ' + e.message, true); });
  },

  load: function () {
    var st = this.state;
    return Promise.all([getAll('shorts'), getAll('templates'), getAll('settings')]).then(function (r) {
      st.shorts = r[0].map(normalizeShort);
      st.templates = r[1];
      var bt = r[2].filter(function (x) { return x.id === 'blockTypes'; })[0];
      st.blockTypes = bt && bt.list && bt.list.length ? bt.list : DEFAULT_BLOCK_TYPES.slice();
    });
  },

  find: function (id) { return this.state.shorts.filter(function (s) { return s.id === id; })[0] || null; },

  save: function (s) {
    var n = normalizeShort(s);
    n.updatedAt = Date.now();
    var arr = this.state.shorts, i = arr.findIndex(function (x) { return x.id === n.id; });
    if (i >= 0) arr[i] = n; else arr.push(n);
    return put('shorts', n).then(function () { return n; }, function (e) {
      toast('保存できませんでした（' + (e && (e.name || e.message)) + '）。容量不足の場合はスクショを減らすか、バックアップを書き出してください', true);
      throw e;
    });
  },

  saveTemplate: function (t) {
    var arr = this.state.templates, i = arr.findIndex(function (x) { return x.id === t.id; });
    if (i >= 0) arr[i] = t; else arr.push(t);
    return put('templates', t).then(function () { return t; });
  },

  saveBlockTypes: function () {
    return put('settings', { id: 'blockTypes', list: this.state.blockTypes });
  },

  remove: function (store, id) {
    this.state[store] = this.state[store].filter(function (x) { return x.id !== id; });
    if (store === 'shorts' && this.currentId === id) this.currentId = null;
    return del(store, id);
  },

  blockColor: function (name) {
    var t = this.state.blockTypes.filter(function (b) { return b.name === name; })[0];
    return t ? t.color : '#999';
  },

  go: function (tab, arg) {
    if (this.tab === 'edit' && window.editSaveNow) editSaveNow();
    if (window.destroyPlayer && (tab !== 'edit' || arg)) destroyPlayer();
    this.tab = tab;
    if (tab === 'edit' && arg) this.currentId = arg;
    document.querySelectorAll('nav [data-tab]').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === tab); });
    document.querySelectorAll('.tab').forEach(function (s) { s.classList.toggle('hidden', s.id !== 'tab-' + tab); });
    this.render();
    window.scrollTo(0, 0);
  },

  render: function () {
    var el = document.getElementById('tab-' + this.tab);
    el.innerHTML = '';
    var fn = { list: window.renderList, edit: window.renderEdit, templates: window.renderTemplates, analyze: window.renderAnalyze }[this.tab];
    if (fn) fn(el);
  },

  initSettings: function () {
    var self = this, mode = 'add';
    var panel = document.getElementById('settings-panel');
    var file = document.getElementById('import-file');
    document.getElementById('btn-settings').addEventListener('click', function () { panel.classList.toggle('hidden'); });
    document.getElementById('export').addEventListener('click', function () {
      var blob = new Blob([exportData(self.state)], { type: 'application/json' });
      var a = h('a', { href: URL.createObjectURL(blob), download: 'short-kousei-backup-' + new Date().toISOString().slice(0, 10) + '.json' });
      document.body.appendChild(a); a.click(); a.remove();
      toast('書き出しました');
    });
    document.getElementById('import-add').addEventListener('click', function () { mode = 'add'; file.value = ''; file.click(); });
    document.getElementById('import-replace').addEventListener('click', function () { mode = 'replace'; file.value = ''; file.click(); });
    file.addEventListener('change', function () {
      var f = file.files[0];
      if (!f) return;
      f.text().then(function (text) {
        var r = validateImport(text);
        if (!r.ok) { toast(r.error + '（データは変更していません）', true); return; }
        if (mode === 'replace' && !confirm('今のデータをすべて消して、読み込んだデータに置き換えます。よろしいですか？')) return;
        return self.importData(r.data, mode).then(function () {
          toast((mode === 'replace' ? '置き換えました' : '追加しました') + '（ショート' + r.data.shorts.length + '件・型' + r.data.templates.length + '件）');
          self.render();
        });
      }).catch(function (e) { toast('読み込みに失敗しました（データは変更していません）: ' + (e && e.message), true); self.render(); });
    });
  },

  importData: function (data, mode) {
    var self = this;
    var shorts = data.shorts.map(normalizeShort), templates = data.templates;
    var local = {};
    self.state.shorts.forEach(function (s) { local[s.id] = s; });
    if (mode === 'add') {
      // 同じIDで手元の方が新しいものは上書きしない
      shorts = shorts.filter(function (s) { var l = local[s.id]; return !l || (Number(s.updatedAt) || 0) > (Number(l.updatedAt) || 0); });
    }
    var blockTypes = null;
    if (data.blockTypes && data.blockTypes.length) {
      if (mode === 'replace') blockTypes = data.blockTypes;
      else {
        var names = self.state.blockTypes.map(function (b) { return b.name; });
        blockTypes = self.state.blockTypes.concat(data.blockTypes.filter(function (b) { return b && names.indexOf(b.name) < 0; }));
      }
    }
    if (window.editDiscardDraft) editDiscardDraft();
    return openDB().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(['shorts', 'templates', 'settings'], 'readwrite');
        t.oncomplete = function () { res(); };
        t.onerror = function (e) { e.preventDefault(); };
        t.onabort = function () { rej(t.error || new Error('読み込みを取り消しました')); };
        try {
          if (mode === 'replace') ['shorts', 'templates', 'settings'].forEach(function (n) { t.objectStore(n).clear(); });
          shorts.forEach(function (s) { t.objectStore('shorts').put(s); });
          templates.forEach(function (x) { t.objectStore('templates').put(x); });
          if (blockTypes) t.objectStore('settings').put({ id: 'blockTypes', list: blockTypes });
        } catch (e) {
          try { t.abort(); } catch (e2) { /* already finished */ }
          rej(e);
        }
      });
    }).then(function () { return self.load(); }, function (e) { return self.load().then(function () { throw e; }); });
  }
};
window.App = App;

document.addEventListener('DOMContentLoaded', function () { App.init(); });
