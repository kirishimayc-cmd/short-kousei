import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const B = require('../../src/backup.js');

const data = { shorts: [{ id: 'a', title: 'x' }], templates: [{ id: 't' }], blockTypes: [{ name: 'フック', color: '#000' }] };

test('export/validate roundtrip', () => {
  const r = B.validateImport(B.exportData(data));
  assert.equal(r.ok, true);
  assert.deepEqual(r.data.shorts, data.shorts);
  assert.deepEqual(r.data.templates, data.templates);
  assert.deepEqual(r.data.blockTypes, data.blockTypes);
});

test('broken json rejected', () => {
  const r = B.validateImport('{');
  assert.equal(r.ok, false);
  assert.match(r.error, /読み込めません/);
});

test('other app rejected', () => {
  assert.equal(B.validateImport('{"app":"other"}').ok, false);
  assert.equal(B.validateImport('{"app":"short-kousei","shorts":{}}').ok, false);
});

test('validateImport assigns ids to records missing them', () => {
  const r = B.validateImport(JSON.stringify({ app: 'short-kousei', shorts: [{ title: 'a' }, { id: null }], templates: [{ name: 'x' }] }));
  assert.equal(r.ok, true);
  for (const x of [...r.data.shorts, ...r.data.templates]) assert.equal(typeof x.id, 'string');
  assert.ok(r.data.shorts[0].id.length > 0);
});

test('validateImport rejects non-object entries', () => {
  assert.equal(B.validateImport(JSON.stringify({ app: 'short-kousei', shorts: [1], templates: [] })).ok, false);
});
