const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createThumbs, loadSharp } = require('../src/services/thumbs');

const mk = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sm-th-'));

test('without sharp the original is served (null) and nothing is created', async () => {
  const dir = mk(); const src = path.join(dir, 'abc.jpg'); fs.writeFileSync(src, 'x');
  assert.equal(await createThumbs(null).thumbFor(src, 480, dir), null);
  assert.ok(!fs.existsSync(path.join(dir, 'thumbs')));
});

test('only whitelisted widths are accepted', async () => {
  const dir = mk(); const src = path.join(dir, 'abc.jpg'); fs.writeFileSync(src, 'x');
  const t = createThumbs(() => { throw new Error('must not be called'); });
  assert.equal(await t.thumbFor(src, 99999, dir), null);
  assert.equal(await t.thumbFor(src, 'abc', dir), null);
});

test('resize failure falls back to the original and leaves no partial files', async () => {
  const dir = mk(); const src = path.join(dir, 'abc.jpg'); fs.writeFileSync(src, 'not a jpeg');
  const sharp = () => ({ resize() { return this; }, jpeg() { return this; }, toFile: async () => { throw new Error('boom'); } });
  assert.equal(await createThumbs(sharp).thumbFor(src, 480, dir), null);
  const left = fs.existsSync(path.join(dir, 'thumbs')) ? fs.readdirSync(path.join(dir, 'thumbs')) : [];
  assert.deepEqual(left, []);
});

test('concurrent requests share one resize; a newer original rebuilds the thumbnail', async () => {
  const dir = mk(); const src = path.join(dir, 'abc.jpg'); fs.writeFileSync(src, 'v1');
  let calls = 0;
  const sharp = (s) => ({ resize() { return this; }, jpeg() { return this; }, toFile: async (out) => { calls++; await new Promise((r) => setTimeout(r, 20)); fs.writeFileSync(out, 'thumb of ' + fs.readFileSync(s)); } });
  const t = createThumbs(sharp);
  const [a, b, c] = await Promise.all([t.thumbFor(src, 480, dir), t.thumbFor(src, 480, dir), t.thumbFor(src, 480, dir)]);
  assert.equal(a, b); assert.equal(b, c);
  assert.equal(calls, 1);
  assert.equal(await t.thumbFor(src, 480, dir), a); assert.equal(calls, 1, 'cached');
  await new Promise((r) => setTimeout(r, 15));
  fs.writeFileSync(src, 'v2');
  await t.thumbFor(src, 480, dir);
  assert.equal(calls, 2);
  assert.equal(fs.readFileSync(a, 'utf8'), 'thumb of v2');
  assert.equal(fs.readFileSync(src, 'utf8'), 'v2', 'original untouched');
});

test('real sharp (when installed): thumbnail is a smaller valid JPEG and the original is unchanged', async (t) => {
  const sharp = loadSharp();
  if (!sharp) return t.skip('sharp not installed in this environment');
  const dir = mk(); const src = path.join(dir, 'abc.jpg');
  const noise = Buffer.alloc(1600 * 1600 * 3); for (let i = 0; i < noise.length; i++) noise[i] = (i * 31 + (i >> 7)) & 255;
  await sharp(noise, { raw: { width: 1600, height: 1600, channels: 3 } }).jpeg({ quality: 92 }).toFile(src);
  const before = fs.readFileSync(src);
  const out = await createThumbs(sharp).thumbFor(src, 480, dir);
  assert.ok(out && fs.statSync(out).size < before.length / 4);
  const meta = await sharp(out).metadata();
  assert.equal(meta.format, 'jpeg'); assert.equal(meta.width, 480);
  assert.ok(before.equals(fs.readFileSync(src)));
});
