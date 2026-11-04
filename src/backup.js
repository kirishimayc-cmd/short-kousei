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
  return { ok: true, data: { shorts: o.shorts, templates: o.templates, blockTypes: Array.isArray(o.blockTypes) ? o.blockTypes : null } };
}

if (typeof module !== 'undefined') module.exports = { exportData: exportData, validateImport: validateImport };
