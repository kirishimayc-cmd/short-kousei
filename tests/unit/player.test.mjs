import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const M = require('../../src/model.js');

const YT = 'https://www.youtube-nocookie.com/embed/abcDEF12_-x?autoplay=1&loop=1&playlist=abcDEF12_-x&playsinline=1&rel=0';

test('youtube shorts / watch / youtu.be / m. → nocookie embed', () => {
  for (const u of ['https://www.youtube.com/shorts/abcDEF12_-x', 'https://youtube.com/shorts/abcDEF12_-x?si=zz',
    'https://m.youtube.com/watch?v=abcDEF12_-x&t=3', 'https://youtu.be/abcDEF12_-x', 'youtube.com/shorts/abcDEF12_-x'])
    assert.equal(M.playerUrl(u).url, YT, u);
  assert.equal(M.playerUrl('https://www.youtube.com/shorts/abcDEF12_-x').site, 'youtube');
});

test('tiktok and instagram → embed players', () => {
  assert.equal(M.playerUrl('https://www.tiktok.com/@neko/video/7300000000000000001').url,
    'https://www.tiktok.com/player/v1/7300000000000000001?autoplay=1&loop=1');
  assert.equal(M.playerUrl('https://www.instagram.com/reel/C1a2B3c4D5e/?igsh=x').url,
    'https://www.instagram.com/reel/C1a2B3c4D5e/embed/');
});

test('other http urls pass through, bad schemes rejected', () => {
  assert.equal(M.playerUrl('https://example.com/v.mp4').url, 'https://example.com/v.mp4');
  assert.equal(M.playerUrl('javascript:alert(1)'), null);
  assert.equal(M.playerUrl(''), null);
});
