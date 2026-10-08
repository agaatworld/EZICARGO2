# EZICARGO 2 — v2 rebuild

The latest EZICARGO customer app, rebuilt from scratch with tests.
EZICARGO is the trade OS between Chinese factories and traders in Malaysia, Singapore, Brunei and the Gulf.

## What's inside
- **Main tabs:** Home · Shop · Warehouse (centre button) · Wallet · Account. Each tab has a row of buttons for its sub-pages.
- **Services:**
  - **EZI Ship:** Guangzhou warehouse with declare, measure, photos, inspect, keep, return, consolidate and ship flows.
  - **Shop:** verified factories, price tiers, reviews, factory chat and cart.
  - **EZI Wallet:** top up, pay suppliers in CNY, and escrow that releases only after inspection.
  - **Group Buy:** deposit held in escrow and refunded in full if the minimum isn't reached.
  - **EZI Credit:** trust score and repayment.
- **Control centre:** an admin preview.
- **Languages:** English, Bahasa Melayu, 中文 and العربية (full right-to-left layout).
- **Themes:** Light, Mist and Dark.

## Engineering
- Vanilla ES modules with hash routing and no build step.
- All money is integer sen/fen. A double-entry ledger checks that every transaction balances; balances are always computed and never stored.
- State changes go through `transact()`, which checks invariants and rolls back if any fail.
- Every money flow is a step-by-step wizard: steps → review → PIN → receipt.
- HTML is auto-escaped by default, and URLs are checked before use.

```
src/core     money, ledger, store, html escaping, i18n
src/domain   catalog, pricing, escrow state machine, rules, services (all mutations)
src/ui       UI kit, icons, wizard engine
src/pages    one file per page
styles/      design tokens and the three themes
tests/       unit tests (node) and end-to-end tests (Playwright)
```

## Run
```
python3 -m http.server 8080      # then open http://localhost:8080
node --test tests/unit/*.test.mjs   # unit tests (27)
```
The end-to-end scripts in `tests/e2e/` need Playwright and Chromium.

The app runs on demo data only. Payments are in test mode until a licensed payment partner is connected. The test PIN is `246810`.

© EZICARGO RICH SDN. BHD. (201601014585 (1185516-M))
