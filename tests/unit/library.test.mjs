import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const A = require('../../src/analysis.js');

const shorts = [
  { id: 'a', title: 'A', kind: 'research', views: 1000, ses: [{ t: 1, kind: 'ドン', owned: '持ってない' }, { t: 5, kind: ' ドン ' }], telops: [], cuts: [], shots: [], memos: [] },
  { id: 'b', title: 'B', kind: 'posted', views: 3000, ses: [{ t: 2, kind: 'ドン', owned: '持ってる' }, { t: 3, kind: '' }], telops: [{ t: 0, text: 'x', font: 'けいふぉんと' }], cuts: [{ t: 1, type: '寄り' }], shots: [{ t: 0, notes: [{ label: '構図', body: '顔' }] }], memos: [{ title: '気づき', body: 'b' }] },
];

test('library groups SE by kind with counts and average views', () => {
  const g = A.library('ses', shorts);
  assert.equal(g[0].key, 'ドン');
  assert.equal(g[0].items.length, 3);
  assert.equal(g[0].shortCount, 2);
  assert.equal(g[0].avgViews, 2000);
  assert.equal(g.find(x => x.key === '（未入力）').items.length, 1);
});

test('library item carries source short info', () => {
  const it = A.library('ses', shorts)[0].items[0];
  assert.ok(['A', 'B'].includes(it.title));
  assert.ok('t' in it && 'shortId' in it && 'views' in it);
});

test('library other sections', () => {
  assert.equal(A.library('telops', shorts)[0].key, 'けいふぉんと');
  assert.equal(A.library('cuts', shorts)[0].key, '寄り');
  assert.equal(A.library('notes', shorts)[0].key, '構図');
  assert.equal(A.library('memos', shorts)[0].key, '気づき');
});
