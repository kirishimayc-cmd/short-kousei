// ===== backup.js : JSON書き出し・検証 =====
function exportData(d) {
  return JSON.stringify({
    app: 'short-kousei', version: 1, exportedAt: new Date().toISOString(),
    shorts: d.shorts || [], templates: d.templates || [], blockTypes: d.blockTypes || []
  });
}

function validateImport(text) {
  var o;
  try { o = JSON.parse(text); } catch (e) {
    return { ok: false, error: 'ファイルを読み込めません（JSONの形式が壊れています）' };
  }
  if (!o || o.app !== 'short-kousei') {
    return { ok: false, error: 'このツールのバックアップファイルではありません' };
  }
  if (!Array.isArray(o.shorts) || !Array.isArray(o.templates)) {
    return { ok: false, error: 'バックアップの中身が足りません（shorts / templates が見つかりません）' };
  }
  var all = o.shorts.concat(o.templates);
  if (all.some(function (x) { return !x || typeof x !== 'object' || Array.isArray(x); })) {
    return { ok: false, error: 'バックアップの中身が壊れています（不正なデータが含まれています）' };
  }
  all.forEach(function (x) {
    if (typeof x.id !== 'string' || !x.id) x.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  });
  return { ok: true, data: { shorts: o.shorts, templates: o.templates, blockTypes: Array.isArray(o.blockTypes) ? o.blockTypes : null } };
}

if (typeof module !== 'undefined') module.exports = { exportData: exportData, validateImport: validateImport };
