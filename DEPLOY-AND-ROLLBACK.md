# Deploy and rollback

## Deploy (same as today)
1. Keep your current repo/zip as the backup. Upload this project over the same Render service (build `npm install && npm run build`, start `npm start`, Node 20). No new environment variables, no schema change, no new service.
2. `npm install` will also try to install the optional `sharp` package. If it fails, Render skips it and the app simply serves the original photos (no thumbnails).
3. Smoke test (5 minutes): open `/shop` (cards show, no console errors) -> Google login -> add a product with photos -> open it, check the gallery shows full photos -> like/unlike -> add to cart and place a COD order -> `/shop/admin` loads -> reload the page twice (second load should fetch shop.js/css from cache: DevTools Network shows "disk cache"/200 from cache).
4. Check Render logs for `local save failed` or `db backup failed` lines. A few retries after a restart are normal; repeating lines are not.

## Rollback
Redeploy the previous zip/commit. Data files and the Neon tables are unchanged in format, so the old code reads them as before. Browsers pick up the old service worker on next visit; hashed asset URLs are simply no longer used.

## Opt-in pagination
`GET /shop/api/products?limit=24&offset=0` returns `{products, total, offset, limit, hasMore}` (limit max 100). Without `limit` nothing changes. The current frontend does not use it, so no product can be hidden.

## Known limits (not fixed, by design)
- Data still lives in whole JSON files. Writes are batched and non-blocking, but each flush rewrites the whole file, and `stats.productViews`/`devices` grow with traffic. Moving products/orders/stats to real PostgreSQL tables is the real long-term fix (larger migration, separate task).
- Local files are saved a moment after the change (next tick; stats within 750 ms) and flushed on SIGTERM. A hard crash (OOM/SIGKILL) can lose the last moments, as the Neon mirror always could. On Render Free `/tmp` is wiped anyway; Neon is the durable copy.
- `addProduct` still writes photo files synchronously (its signature is unchanged); a seller upload briefly blocks the loop.
- Thumbnails are not available for photos stored on Get Pronto (the route redirects to the provider); they need `sharp`. Thumbnails live in `<DATA_DIR>/images/thumbs` and are rebuilt after a restart on Render Free.
- A product deleted while its owner is saving an edit can leave orphan photo files/rows (rare).
- Single-process design: running more than one instance would still have conflicting writers, as before.
- `i18n-shop.js` (111 KB) still loads up front; making it lazy would change load order and was left alone.
- No claim is made about capacity: the numbers in TEST-REPORT.md come from a synthetic store benchmark, not an HTTP load test.
