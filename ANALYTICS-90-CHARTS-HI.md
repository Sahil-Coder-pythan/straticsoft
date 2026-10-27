# Stratic Market — Seller Analytics Update

## What this revision actually changes
- The seller-only shop dashboard contains **81 chart panels**: 27 report definitions, each rendered for one of three selectable periods (last 24 hours, 7 days, 30 days).
- The period selector reloads the seller's shop URL with `analyticsPeriod=24h`, `7d`, or `30d`; only the selected period's 27 panels are visible.
- Reports use saved seller orders, product records, and recorded signed-in product-view events. Existing order/payment history remains visible only to the owner of that shop.
- Online payments count as verified only when the saved payment status is `VERIFIED`. COD is kept separate from online payments. Cancelled and pending orders are excluded from confirmed-sales totals.
- Named viewers are shown only when the visitor was signed in and the view event has a recorded user ID. Anonymous visits must not be given invented names or profile photos.
- Country/state reporting uses saved order address fields; absent data is not inferred. The existing anonymous product-view counter has no per-view timestamps, so it is not presented as a timestamped historical series.
- Return tracking and visitor language analytics are **not claimed as implemented** because the current order workflow/view events do not persist enough information to report them truthfully.

## Important deployment note
This is source code, not a live deployment. It must be reviewed and deployed to Render before the public shop page changes. The page shows seller analytics only when the logged-in account ID matches the seller ID encoded in that shop link.

## Validation
- `node --check src/routes/shop.js` passes.
- `node --check src/services/shop-store.js` passes.
- The included static test checks that the analytics source contains 27 report definitions and the three requested time windows.
- Full integration testing still depends on the complete runtime environment and the service modules absent from this supplied project snapshot.
