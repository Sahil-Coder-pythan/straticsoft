# CHANGELOG — performance pass (no UI, API, schema or feature changes)

Base: `stratic-market-image-layout-fix.zip` (folder `finalfix`). The original upload was not modified; this is a separate copy.

## Modified files
| File | What changed | Why |
|---|---|---|
| `src/services/shop-store.js` | (1) Local file saves are now asynchronous, one writer per file, atomic tmp+rename, newest snapshot wins, retried with backoff on failure, flushed on shutdown. (2) Neon mirror: while a full-blob upload of a key is waiting, newer snapshots replace its payload instead of queueing another upload (order kept, retry uses the same snapshot). (3) `ensure()` runs once instead of on every read/write. (4) Read-only lookups (`findAccount*`, `getProduct`, `listProducts`, `listOrders`, `txnUsed`, `productLikeInfo`, `productViewCount`) no longer copy the whole data file; they copy only the records they return. (5) Newest-first product index + id map, rebuilt automatically whenever products change. (6) `stats` (largest, hottest file) is changed in place and serialized once per flush instead of once per change. (7) `recordVisit` / `recordProductView` return early when nothing changes. (8) `updateProduct` re-reads products after its async photo work (fixes a lost-update race) and uses async file I/O. (9) `ensureImage` is async and de-duplicated. (10) New exports: `listProductsBySeller`, `findOrderByRef`, `flush`, `shutdown`, `persistenceStatus`. Data format, existing exports and return values are unchanged. | `/api/products` called `productLikeInfo` twice per product and each call copied the entire stats file; every write blocked the event loop and re-uploaded the whole blob. |
| `src/routes/shop.js` | `pview` computes like info once; `/api/products` supports **opt-in** `?limit=&offset=` (adds `total/offset/limit/hasMore`; without `limit` the response is identical); seller lists and order-by-ref lookups use the new cheap store calls; `/shop/img/:id` uses async file checks, accepts optional `?w=240\|480` (thumbnail when available, original otherwise) and sends `Cache-Control: public, max-age=604800` (was 86400; photo URLs change when a photo is edited). | Fewer copies per request, smaller images for list cards. |
| `src/public/js/shop.js` | Added `thumb()` and used it for the three product-card image lists (`?w=480`, `decoding=async`). Gallery/detail images still use the original URLs. | Avoid downloading 1600px photos for small cards. |
| `src/app.js` | `/static`: a CSS/JS file requested with its **current content hash** (`?v=<hash>`) is sent `public, max-age=31536000, immutable`; everything else stays `no-cache` as before. `app.locals.asset()` added. | Large JS/CSS were revalidated on every visit. |
| `src/views/shop.ejs` | The 4 asset URLs (`shop.css`, `i18n-shop.js`, `qr-mini.js`, `shop.js`) now come from `asset()` (hash computed from file contents at startup) instead of hand-edited `?v=` strings. No markup/design change. | A changed file always gets a new URL, an unchanged file keeps its cache. |
| `src/public/sw.js` | Cache name bumped; hashed CSS/JS served cache-first (old copies of the same file removed); stale hand-versioned CSS entry dropped from the precache list. | Repeat visits need no network for the big assets. |
| `src/server.js` | On SIGTERM/SIGINT call `store.shutdown()` (save pending data, push latest snapshots to Neon, max ~13 s) then exit. | Render sends SIGTERM on each deploy; pending writes were dropped. |
| `package.json` | `optionalDependencies: sharp ^0.34.5`; scripts `test:perf`, `check` extended. | Thumbnails (optional; app works without it). |

## New files
`src/services/thumbs.js` (optional thumbnails), `src/services/assets.js` (content-hash URLs), `test/perf-*.test.js` (25 tests), `tools/bench-store.js`, `tools/compare-stores.js`, `CHANGELOG.md`, `TEST-REPORT.md`, `DEPLOY-AND-ROLLBACK.md`.

## Not changed
Database schema/data format, API routes and default responses, auth/sessions, EJS markup, CSS, translations, orders, uploads, image storage integrations (Neon, CockroachDB, Get Pronto), the 20 pre-existing test files, `docs/`.
