// ===== capture.js : 画面共有と撮影 =====
var Capture = { stream: null, video: null, endedCbs: [] };

function isSharing() {
  var s = Capture.stream;
  return !!(s && s.getVideoTracks().some(function (t) { return t.readyState === 'live'; }));
}

function onShareEnded(cb) { Capture.endedCbs.push(cb); }

function _shareEnded() {
  Capture.stream = null;
  if (Capture.video) { Capture.video.srcObject = null; }
  Capture.endedCbs.forEach(function (cb) { try { cb(); } catch (e) { /* noop */ } });
}

function startShare() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    return Promise.reject(new Error('このブラウザは画面共有に対応していません（Chrome か Edge で開いてください）'));
  }
  return navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false }).then(function (stream) {
    Capture.stream = stream;
    stream.getVideoTracks().forEach(function (t) { t.addEventListener('ended', _shareEnded); });
    if (!Capture.video) {
      Capture.video = document.createElement('video');
      Capture.video.muted = true;
      Capture.video.playsInline = true;
    }
    Capture.video.srcObject = stream;
    return Capture.video.play().catch(function () {}).then(function () { return _waitFrame(); });
  });
}

function stopShare() {
  if (Capture.stream) Capture.stream.getTracks().forEach(function (t) { t.stop(); });
  _shareEnded();
}

function _waitFrame() {
  var v = Capture.video;
  return new Promise(function (res) {
    var n = 0;
    (function check() {
      if (v.videoWidth > 0 || n++ > 60) return res();
      setTimeout(check, 50);
    })();
  });
}

function grabFrame() {
  if (!isSharing()) return Promise.reject(new Error('画面共有が止まっています'));
  return _waitFrame().then(function () {
    var v = Capture.video, w = v.videoWidth, hh = v.videoHeight;
    if (!w || !hh) throw new Error('画面を取得できませんでした');
    var scale = Math.min(1, 1080 / Math.max(w, hh));
    var c = document.createElement('canvas');
    c.width = Math.round(w * scale); c.height = Math.round(hh * scale);
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85);
  });
}
