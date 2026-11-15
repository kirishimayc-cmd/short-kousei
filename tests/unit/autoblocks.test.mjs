import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const M = require('../../src/model.js');

const pick = bs => bs.map(b => [b.type, b.start, b.end]);

test('marks become merged blocks to the end of the video', () => {
  const bs = M.buildBlocks([{ t: 0, type: 'フック' }, { t: 2, type: '展開' }, { t: 5, type: '展開' }, { t: 20, type: 'オチ' }], 30, []);
  assert.deepEqual(pick(bs), [['フック', 0, 2], ['展開', 2, 20], ['オチ', 20, 30]]);
});

test('first block starts at 0 and marks are sorted', () => {
  const bs = M.buildBlocks([{ t: 10, type: 'オチ' }, { t: 3, type: 'フック' }], 15, []);
  assert.deepEqual(pick(bs), [['フック', 0, 10], ['オチ', 10, 15]]);
});

test('memos carried over from old blocks of the same type', () => {
  const bs = M.buildBlocks([{ t: 0, type: 'フック' }, { t: 4, type: 'オチ' }], 10, [{ type: 'オチ', start: 5, end: 10, memo: '落とす' }]);
  assert.equal(bs[1].memo, '落とす');
});

test('no marks → null (leave blocks alone); empty types ignored', () => {
  assert.equal(M.buildBlocks([], 10, []), null);
  assert.equal(M.buildBlocks([{ t: 1, type: '' }], 10, []), null);
});

test('marksOf collects cut and shot labels, shot wins at same time', () => {
  const s = { cuts: [{ t: 0, block: 'フック' }, { t: 4, block: '前振り' }, { t: 8 }], shots: [{ t: 4, block: '展開' }, { t: 12, block: 'オチ' }] };
  assert.deepEqual(M.marksOf(s), [{ t: 0, type: 'フック' }, { t: 4, type: '展開' }, { t: 12, type: 'オチ' }]);
});
