/**
 * Optional on-demand thumbnails for product-list cards.
 *
 * Uses the `sharp` package when it is installed (listed under optionalDependencies). If it is missing or a
 * resize fails, thumbFor() returns null and the caller serves the ORIGINAL image, so nothing breaks.
 * Originals are never modified; thumbnails are separate cache files under <images>/thumbs and are rebuilt when
 * the original is newer (photo edited).
 */
const fs = require('fs');
const path = require('path');
const fsp = fs.promises;

const WIDTHS = [240, 480];

function loadSharp() {
  try {
    const sharp = require('sharp');
    try { sharp.cache({ memory: 32, items: 16, files: 0 }); sharp.concurrency(1); } catch (e) { /* older versions */ }
    return sharp;
  } catch (e) { return null; }
}

function createThumbs(sharp, opts) {
  const quality = (opts && opts.quality) || 72;
  const inflight = new Map();

  async function build(src, out, w) {
    const tmp = out + '.' + process.pid + '.tmp';
    try {
      await fsp.mkdir(path.dirname(out), { recursive: true });
      await sharp(src).resize({ width: w, withoutEnlargement: true }).jpeg({ quality }).toFile(tmp);
      await fsp.rename(tmp, out);
      return out;
    } catch (e) {
      try { await fsp.unlink(tmp); } catch (e2) { /* ignore */ }
      return null;
    }
  }

  // Returns the path of a thumbnail (creating it if needed) or null -> serve the original.
  async function thumbFor(srcPath, width, imagesDir) {
    if (!sharp || !WIDTHS.includes(Number(width))) return null;
    const w = Number(width);
    const out = path.join(imagesDir, 'thumbs', path.basename(srcPath, '.jpg') + '_' + w + '.jpg');
    try {
      const [s, t] = await Promise.all([fsp.stat(srcPath), fsp.stat(out).catch(() => null)]);
      if (t && t.mtimeMs >= s.mtimeMs && t.size > 0) return out;
    } catch (e) { return null; }
    const key = out;
    if (!inflight.has(key)) inflight.set(key, build(srcPath, out, w).finally(() => inflight.delete(key)));
    return inflight.get(key);
  }
  return { thumbFor, WIDTHS };
}

module.exports = { createThumbs, loadSharp, WIDTHS, default: createThumbs(loadSharp()) };
