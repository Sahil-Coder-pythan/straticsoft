# Stratic Market — Seller Analytics Update

## Seller shop analytics
- The seller's own public shop page now renders 90 analytics charts: 18 report types across 24 hours, 7 days, 30 days, 90 days, and all recorded time.
- Reports cover order volume, INR sales (cancelled and payment-pending excluded), COD orders, online payment orders, verified online payments, awaiting/rejected payments, cancellations, shipped/delivered/confirmed orders, units ordered, unique buyers, registered shopper product views, product uploads, delivery countries/states, best-selling products and lowest-selling products.
- A recent order/payment history list is shown to the seller for that seller's own shop orders. Online payment is only labeled verified when the stored payment status is VERIFIED.
- Charts are built from stored records, not sample data. Missing information is not inferred. Country/state charts use delivery address fields when provided.
- Named viewer history only exists for signed-in visitors whose product-view event was recorded. Anonymous visitors remain anonymous; the existing product-view total is device-based and does not have historical timestamps, so it is not misrepresented as a historical chart series.
- Return analytics are not included because the existing order workflow does not currently implement a return status/process. Do not claim returns are tracked until that workflow is added.

## Validation
- `node --check src/routes/shop.js`, `node --check src/app.js`, and `node --check src/services/shop-store.js` pass.
- `npm test` cannot pass on the supplied project snapshot because numerous pre-existing service modules imported by tests are missing (for example `src/services/address-service.js`, `src/services/ai-guardrails-service.js`, and others). These were not fabricated as part of the analytics change.
- This ZIP does not deploy itself to Render. Deploy only after reviewing the changes and confirming the environment configuration.
