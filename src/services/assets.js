/**
 * Content-hashed asset URLs.
 * asset('/js/shop.js') -> '/static/js/shop.js?v=<first 10 hex chars of the file's sha1>'.
 * The hash is computed from the file bytes at startup, so every deploy that changes a file automatically
 * produces a new URL; unchanged files keep their URL (and stay cached). No build step or dependency needed.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function createAssets(publicDir) {
  const hashes = new Map();
  function hashOf(rel) {
    if (hashes.has(rel)) return hashes.get(rel);
    let h = null;
    try {
      const abs = path.join(publicDir, rel);
      if (abs.startsWith(publicDir)) h = crypto.createHash('sha1').update(fs.readFileSync(abs)).digest('hex').slice(0, 10);
    } catch (e) { h = null; }
    hashes.set(rel, h);
    return h;
  }
  function asset(rel) {
    const h = hashOf(rel);
    return '/static' + rel + (h ? '?v=' + h : '');
  }
  // True only when the request carries the CURRENT hash of that file (so a stale URL is never marked immutable).
  function isCurrent(rel, v) {
    const h = hashOf(rel);
    return !!h && v === h;
  }
  return { asset, isCurrent };
}

module.exports = { createAssets };
