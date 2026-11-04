import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const C = require('../../src/capture.js');

test('cropRect scales element rect from viewport to frame', () => {
  const r = C.cropRect({ left: 100, top: 50, width: 300, height: 500 }, { w: 1000, h: 800 }, { w: 2000, h: 1600 });
  assert.deepEqual(r, { x: 200, y: 100, w: 600, h: 1000 });
});

test('cropRect clamps to frame', () => {
  const r = C.cropRect({ left: -20, top: 700, width: 300, height: 500 }, { w: 1000, h: 800 }, { w: 1000, h: 800 });
  assert.deepEqual(r, { x: 0, y: 700, w: 280, h: 100 });
});

test('cropRect returns null for invisible element', () => {
  assert.equal(C.cropRect({ left: 0, top: 900, width: 300, height: 500 }, { w: 1000, h: 800 }, { w: 1000, h: 800 }), null);
});

test('fitSize keeps long side <= 1080', () => {
  assert.deepEqual(C.fitSize(2160, 3840), { w: 608, h: 1080 });
  assert.deepEqual(C.fitSize(500, 300), { w: 500, h: 300 });
});
