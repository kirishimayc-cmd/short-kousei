import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const M = require('../../src/model.js');

test('newShort creates empty short of kind', () => {
  const a = M.newShort('plan'), b = M.newShort('plan');
  assert.equal(a.kind, 'plan');
  for (const k of ['tags', 'blocks', 'cuts', 'telops', 'ses', 'shots', 'memos']) assert.deepEqual(a[k], []);
  assert.notEqual(a.id, b.id);
});

test('normalizeShort swaps and clamps blocks', () => {
  const s = M.normalizeShort({ ...M.newShort('research'), duration: '30',
    blocks: [{ type: 'オチ', start: 25, end: 40 }, { type: 'フック', start: 10, end: 5 }] });
  assert.equal(s.duration, 30);
  assert.deepEqual(s.blocks.map(b => [b.start, b.end]), [[5, 10], [25, 30]]);
});

test('normalizeShort sorts cuts and coerces numbers', () => {
  const s = M.normalizeShort({ ...M.newShort('research'), views: '1200', cuts: [{ t: '5' }, { t: 2 }] });
  assert.equal(s.views, 1200);
  assert.deepEqual(s.cuts.map(c => c.t), [2, 5]);
});

test('template roundtrip scales by duration', () => {
  const s = { ...M.newShort('research'), duration: 30, blocks: [{ type: 'フック', start: 0, end: 3, memo: 'x' }] };
  const t = M.templateFromShort(s, '型A');
  assert.equal(t.name, '型A');
  assert.equal(t.sourceId, s.id);
  const p = M.shortFromTemplate(t, 60);
  assert.equal(p.kind, 'plan');
  assert.equal(p.templateId, t.id);
  assert.deepEqual([p.blocks[0].start, p.blocks[0].end], [0, 6]);
});

test('zero-duration template does not throw', () => {
  const s = { ...M.newShort('research'), duration: 0, blocks: [{ type: 'フック', start: 0, end: 3 }] };
  const t = M.templateFromShort(s, 'z');
  assert.equal(t.blocks[0].startRatio, null);
  const p = M.shortFromTemplate(t, 0);
  assert.equal(p.blocks.length, 1);
  assert.deepEqual([p.blocks[0].start, p.blocks[0].end], [0, 3]);
});
