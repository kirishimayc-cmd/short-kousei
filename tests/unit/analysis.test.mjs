import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const A = require('../../src/analysis.js');

const base = { duration: 30, blocks: [{ type: 'フック', start: 0, end: 2 }, { type: 'オチ', start: 24, end: 30 }],
  cuts: [1, 2, 3, 4, 5].map(t => ({ t })) };

test('metrics basic', () => {
  assert.deepEqual(A.metrics(base), { hookSec: 2, punchPct: 80, hasCTA: false, cutCount: 5, avgCutSec: 5 });
});

test('metrics zero duration gives null', () => {
  const m = A.metrics({ ...base, duration: 0 });
  assert.equal(m.punchPct, null);
  assert.equal(m.avgCutSec, null);
  assert.equal(m.hookSec, 2);
});

test('metrics no hook, has CTA', () => {
  const m = A.metrics({ duration: 20, blocks: [{ type: 'CTA', start: 18, end: 20 }], cuts: [] });
  assert.equal(m.hookSec, null);
  assert.equal(m.hasCTA, true);
  assert.equal(m.avgCutSec, 20);
});

test('templateStats averages posted only', () => {
  const shorts = [
    { kind: 'posted', templateId: 't', views: 100 },
    { kind: 'posted', templateId: 't', views: 300 },
    { kind: 'plan', templateId: 't', views: 999 },
    { kind: 'posted', templateId: 'x', views: 5 }];
  assert.deepEqual(A.templateStats('t', shorts), { count: 2, avgViews: 200 });
  assert.deepEqual(A.templateStats('none', shorts), { count: 0, avgViews: null });
});
