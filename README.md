# Currency Exchange

A small, fast currency converter for **Indonesian Rupiah (IDR)**, **US Dollar (USD)**
and **Tunisian Dinar (TND)**, using live exchange rates. Static site, no backend,
deployed to GitHub Pages.

Every currency has its own field and they all hold the same value at once: type
an amount into any one of them and the rest update as you type. There is no
direction to pick and no pair to swap.

A currency given a `unit` in that list is both read and entered in it: the
rupiah column counts thousands, marked by a `K` beside the figure, so 150
there means 150,000 rupiah and nobody types the three zeros. The rate under
each figure is stated per displayed unit too, so it multiplies what is on
screen.

Amounts are entered on a keypad built into the page, so the system keyboard
never covers the board: the fields carry `inputmode="none"` on a touch device,
which asks the browser not to raise one while still accepting a physical
keyboard. The decimal key is disabled for a currency quoted in whole units.

The layout is also anchored to the top of the visible viewport rather than
centred in it, and reads that viewport from `visualViewport`, so a system
keyboard raised anyway cannot push the board out of view.

The theme follows the device until you press the toggle, after which the
choice is remembered.

**Live:** https://jebalirami7.github.io/currency-exchange/

## Adding a currency

Add one entry to `CURRENCIES` in [`src/core/currencies.ts`](src/core/currencies.ts):

```ts
{ code: 'EUR', name: 'Euro', decimals: 2 },
```

That is the whole change. The fields, the rate summary, the rate requests and
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

**How often rates change:** open.er-api.com publishes once every 24 hours, so
the app is a live lookup of daily-published rates rather than a ticking feed.
It checks for a new snapshot every 10 minutes (and on tab focus, on regaining
connectivity, and on Refresh), and shows both when the rates were published
and when the next publication is due. Minute-level rates would need a paid
provider.

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

Pushing to the default branch runs
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which
typechecks, tests, builds and publishes to GitHub Pages. The workflow enables
Pages itself on its first run, so there is no manual setup step.

The build needs to know the sub-path the site is served from, so the workflow
passes the repository name as `BASE_PATH`. Renaming the repository therefore
keeps working without a code change.
