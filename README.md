# Currency Exchange

A small, fast currency converter for **Indonesian Rupiah (IDR)**, **US Dollar (USD)**
and **Tunisian Dinar (TND)**, using live exchange rates. Static site, no backend,
deployed to GitHub Pages.

**Live:** https://jebalirami7.github.io/currency-exchange/

## Adding a currency

Add one entry to `CURRENCIES` in [`src/core/currencies.ts`](src/core/currencies.ts):

```ts
{ code: 'EUR', name: 'Euro', flag: '🇪🇺' },
```

That is the whole change. The selectors, the rate table, the rate requests and
the number formatting all derive from that list. Symbols and decimal precision
are deliberately not configured — `Intl` already knows them for every ISO 4217
code, so duplicating them here would only let them drift.

The only thing to check is coverage: the provider must quote the new code. A
provider that does not is skipped automatically (see below).

## How rates are fetched

Rates come straight from the browser, so no API key is involved — a key on a
static site is public anyway.

| Order | Provider | Notes |
| ----- | -------- | ----- |
| 1 | [open.er-api.com](https://open.er-api.com) | Keyless, covers IDR, USD and TND. Updates daily. |
| 2 | [frankfurter.app](https://frankfurter.app) | ECB reference rates. Does **not** quote TND, so it only serves requests it can fully satisfy. |

The [`RateService`](src/rates/rate-service.ts) tries each provider in order and
takes the first snapshot that covers *every* supported currency; partial
coverage is treated as a failure so the next provider gets a turn. A snapshot
is reused for 10 minutes, concurrent callers share one request, and the last
successful snapshot is cached in `localStorage` — if every provider is
unreachable, the app shows those rates and says so rather than showing nothing.

Adding a provider means implementing `RateProvider` and appending it to the
list in `src/rates/rate-service.ts`; nothing else changes.

## Project layout

```
src/
  core/          Currency list, conversion maths, formatting — no DOM, no network
  rates/         Providers, provider fallback, caching
  ui/            DOM wiring
  styles.css
index.html
```

`core/` is pure and has no imports from `rates/` or `ui/`, which is what makes
it straightforward to test.

## Development

```bash
npm install
npm run dev      # dev server
npm test         # unit tests (vitest)
npm run build    # typecheck + production build into dist/
npm run preview  # serve the production build
```

## Deployment

Pushing to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml),
which typechecks, tests, builds and publishes to GitHub Pages.

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

The build needs to know the sub-path the site is served from, so the workflow
passes the repository name as `BASE_PATH`. Renaming the repository therefore
keeps working without a code change.
