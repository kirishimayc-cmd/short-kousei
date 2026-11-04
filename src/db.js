// ===== db.js : IndexedDB =====
var DB_NAME = 'short-kousei';
var _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise(function (res, rej) {
    var r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = function () {
      var db = r.result;
      ['shorts', 'templates', 'settings'].forEach(function (n) {
        if (!db.objectStoreNames.contains(n)) db.createObjectStore(n, { keyPath: 'id' });
      });
    };
    r.onsuccess = function () { _db = r.result; res(_db); };
    r.onerror = function () { rej(r.error); };
  });
}

function _tx(store, mode, fn) {
  return openDB().then(function (db) {
    return new Promise(function (res, rej) {
      var t = db.transaction(store, mode);
      var out = fn(t.objectStore(store));
      t.oncomplete = function () { res(out && out.result !== undefined ? out.result : undefined); };
      t.onerror = function () { rej(t.error); };
      t.onabort = function () { rej(t.error); };
    });
  });
}

function getAll(store) { return _tx(store, 'readonly', function (s) { return s.getAll(); }); }
function put(store, obj) { return _tx(store, 'readwrite', function (s) { s.put(obj); }); }
function del(store, id) { return _tx(store, 'readwrite', function (s) { s.delete(id); }); }
function putMany(store, arr) { return _tx(store, 'readwrite', function (s) { arr.forEach(function (o) { s.put(o); }); }); }
function clearAll() {
  return openDB().then(function (db) {
    return new Promise(function (res, rej) {
      var t = db.transaction(['shorts', 'templates', 'settings'], 'readwrite');
      ['shorts', 'templates', 'settings'].forEach(function (n) { t.objectStore(n).clear(); });
      t.oncomplete = function () { res(); };
      t.onerror = function () { rej(t.error); };
    });
  });
}
