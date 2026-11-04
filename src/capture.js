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
  return navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false, preferCurrentTab: true, selfBrowserSurface: 'include' }).then(function (stream) {
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

// 要素の位置（画面上）→ 撮った画像上の切り抜き範囲
function cropRect(el, view, frame) {
  var sx = frame.w / view.w, sy = frame.h / view.h;
  var x0 = Math.max(0, Math.round(el.left * sx)), y0 = Math.max(0, Math.round(el.top * sy));
  var x1 = Math.min(frame.w, Math.round((el.left + el.width) * sx)), y1 = Math.min(frame.h, Math.round((el.top + el.height) * sy));
  if (x1 - x0 < 8 || y1 - y0 < 8) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function fitSize(w, hh) {
  var scale = Math.min(1, 1080 / Math.max(w, hh));
  return { w: Math.round(w * scale), h: Math.round(hh * scale) };
}

function toJpeg(src, sx, sy, sw, sh) {
  var f = fitSize(sw, sh);
  var c = document.createElement('canvas');
  c.width = f.w; c.height = f.h;
  c.getContext('2d').drawImage(src, sx, sy, sw, sh, 0, 0, f.w, f.h);
  return c.toDataURL('image/jpeg', 0.85);
}

// cropEl を渡すと、このタブを共有している時はその要素の部分だけを切り抜く
function grabFrame(cropEl) {
  if (!isSharing()) return Promise.reject(new Error('画面共有が止まっています'));
  return _waitFrame().then(function () {
    var v = Capture.video, w = v.videoWidth, hh = v.videoHeight;
    if (!w || !hh) throw new Error('画面を取得できませんでした');
    var r = null;
    if (cropEl) {
      var tr = Capture.stream.getVideoTracks()[0];
      var surface = tr && tr.getSettings ? tr.getSettings().displaySurface : '';
      var vw = window.innerWidth, vh = window.innerHeight;
      var sameShape = Math.abs(w / hh - vw / vh) < 0.06;
      if (surface === 'browser' && sameShape) {
        var b = cropEl.getBoundingClientRect();
        r = cropRect({ left: b.left, top: b.top, width: b.width, height: b.height }, { w: vw, h: vh }, { w: w, h: hh });
      }
    }
    return r ? toJpeg(v, r.x, r.y, r.w, r.h) : toJpeg(v, 0, 0, w, hh);
  });
}

// 画像ファイル（スマホのスクショなど）→ 縮小したJPEG
function imageFileToJpeg(file) {
  return new Promise(function (res, rej) {
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () { try { res(toJpeg(img, 0, 0, img.naturalWidth, img.naturalHeight)); } catch (e) { rej(e); } URL.revokeObjectURL(url); };
    img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('画像を読み込めませんでした: ' + file.name)); };
    img.src = url;
  });
}

if (typeof module !== 'undefined') module.exports = { cropRect: cropRect, fitSize: fitSize };
