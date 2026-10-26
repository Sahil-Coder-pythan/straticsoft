const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createAssets } = require('../src/services/assets');

test('asset URLs carry a content hash that changes only when the file changes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-assets-'));
  fs.mkdirSync(path.join(dir, 'js'));
  fs.writeFileSync(path.join(dir, 'js', 'a.js'), 'one');
  const a1 = createAssets(dir);
  const u1 = a1.asset('/js/a.js');
  assert.match(u1, /^\/static\/js\/a\.js\?v=[0-9a-f]{10}$/);
  assert.equal(createAssets(dir).asset('/js/a.js'), u1, 'same content -> same URL');
  fs.writeFileSync(path.join(dir, 'js', 'a.js'), 'two');
  assert.notEqual(createAssets(dir).asset('/js/a.js'), u1, 'changed content -> new URL');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('only the current hash is treated as immutable; stale, empty and unknown files are not', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-assets-'));
  fs.writeFileSync(path.join(dir, 'x.css'), 'body{}');
  const a = createAssets(dir);
  const v = a.asset('/x.css').split('v=')[1];
  assert.equal(a.isCurrent('/x.css', v), true);
  assert.equal(a.isCurrent('/x.css', '0000000000'), false);
  assert.equal(a.isCurrent('/x.css', ''), false);
  assert.equal(a.isCurrent('/missing.css', v), false);
  assert.equal(a.asset('/missing.css'), '/static/missing.css', 'unknown file: plain URL, never immutable');
  assert.equal(a.isCurrent('/../etc/passwd', v), false);
  fs.rmSync(dir, { recursive: true, force: true });
});
