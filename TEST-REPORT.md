# TEST REPORT

Environment: sandbox, Node v22.22.2 (project targets Node 20), no network, **Express, EJS, pg, bcryptjs etc. are not installed and could not be installed**. Only Node built-ins and a pre-installed `sharp` 0.34.5 were available.

## Executed and passed
- `node --check` on every `.js` file under `src/`, `test/`, `tools/`: no syntax errors.
- `node --test test/perf-*.test.js`: **25 tests, 25 pass, 0 fail**; the whole suite was run 10 times in a row with no failure.
  - Store (14): atomic persistence, no leftover tmp files, 300 rapid writes without loss, private copies, product index invalidation on create/edit/price change/delete, country/expiry filtering, lost-update race in `updateProduct`, delete-during-edit, failed local save (visible, retried, readable, recovers), likes/views/visits, stats persistence, `findOrderByRef`, `shutdown()`.
  - Neon mirroring with a fake `pg` (4): 100 rapid writes -> 1 upload holding all 100; snapshot taken during an upload is uploaded after it; failed upload retried with the same snapshot; pending stats pushed on shutdown.
  - Asset hashing (2) and thumbnails (5, incl. one with real `sharp` 0.34.5: valid JPEG, 480 px wide, >4x smaller on a noisy 1600 px test image, original byte-identical).
- `tools/compare-stores.js`: the same 25 observable operations/results run against the original `shop-store.js` and the new one: **25 of 25 identical** (ids/timestamps excluded).
- Bug found by these tests and fixed before packaging: `shutdown()` could write the same tmp file as an in-flight async save and leave a truncated JSON file. It now waits for in-flight saves and uses its own tmp name.

## Failed / pre-existing
- The 20 original tests in `test/` (not touched): **20 of 20 fail before and after** because they `require` modules that do not exist in `src/` (e.g. `payment-service`, `label-service`). They are 200-byte placeholders; I did not fake the missing modules or weaken them. `npm test` therefore still reports failures; use `npm run test:perf` for the meaningful suite.

## Could NOT be run (unverified)
- The HTTP layer: `/api/products` incl. `?limit=`, `/shop/img/:id?w=`, `/static` cache headers, EJS rendering of `shop.ejs` with `asset()`, service worker behaviour, login/orders/uploads end to end. These edits are small and were reviewed line by line against the original diff, but **not executed**. Please do the smoke test in DEPLOY-AND-ROLLBACK.md before announcing.
- Real PostgreSQL/Neon/CockroachDB/Get Pronto, Render, low-end phone rendering, installing `sharp` on Render, HTTP load test.

## Benchmark (store layer only, synthetic data, one sandbox machine, Node 22; not an HTTP load test)
Data: 5,000 accounts, 20,000 known devices (stats file 0.4–0.65 MB). "Product list request" = what `GET /api/products` does in the store (list + like info per product). `tools/bench-store.js`.

| Measure | Original | New |
|---|---|---|
| Product list, 100 products, p50 / p95 (5 runs) | 2,091 / 2,694 ms | — |
| Product list, 300 products | 7,289 / 7,653 ms (5 runs) | 1.2 / 5.8 ms (20 runs) |
| Product list, 2,000 products | too slow to run (extrapolates to > 45 s) | 6.2 / 16 ms (20 runs) |
| 2 account lookups per request (p50) | 11 ms | 0.02 ms |
| Page view from an already-known device (p50) | 10 ms | 0.001 ms |
| 100 rapid like-writes: caller blocked / longest event-loop stall | 2,249 ms / 2,244 ms | 1 ms / 5 ms (9 ms at 2,000 products) |
| RSS after run (300 products) | 106 MB | 73 MB |
Neon blob uploads for the 100-write burst: 1 in both (stats was already debounced); for the other files the new code coalesces bursts (test above). Response size and thumbnail savings were **not measured** (no running server/real photos); expect list-card images to shrink from the 1600 px originals to ~480 px only where `sharp` is installed and photos are served from the app, not from Get Pronto redirects.

## Remaining risks
See DEPLOY-AND-ROLLBACK.md ("Known limits").
