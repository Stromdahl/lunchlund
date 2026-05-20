# Agent notes — lunchlund

## What this is

A small TypeScript tool that scrapes lunch menus from seven restaurants near
Mobilvägen 10 in Lund (Ideon / Brunnshög) and writes `dist/index.html`,
`dist/lunchlund.json`, and `dist/lunchlund.xml` (RSS). Designed to be
cron-run and published as a static page.

## Architecture

Each scraper exports a **descriptor** (`ScraperDescriptor` in `src/types.ts`)
that owns the restaurant's identity (id, name, address, website) and a
`scrape()` function returning `ScrapedData` (the parsed pieces: note, price,
menu, hours). `src/scrapers/index.ts` collects all descriptors into one
`SCRAPERS` array; `src/scrape.ts` runs them in parallel and merges identity
+ scraped data into the final `Restaurant[]`. A scraper failure attaches an
`error: { source, error }` to the still-rendered card.

Each scraper file is split into a **pure parser** and a thin **fetch + parse
wrapper** invoked by the descriptor. The parser takes a raw HTML/text string
and returns `ScrapedData` — that makes it testable without network I/O.
Shared helpers live in `src/scrapers/lib.ts` (`fetchText`, `fetchBuffer`,
`cleanText`). Swedish day names are centralised in `src/hours.ts` (`DAYS`,
`WEEKDAYS`, `daySv`, `keyFromSv`).

## Data sources

### Bricks Eatery — `https://brickseatery.se/`

WordPress / Elementor page. Shared parser lives in
`src/scrapers/elementor-lunch.ts` and is also used by Edison and Inspira.
Markers:

- `<h2 class="week">` — e.g. "Lunchmeny V21", used as the note.
- Per-day containers with class `monday` / `tuesday` / … (lowercase English).
- Inside each day, one `<div class="lunchmeny_container">` per dish with
  `.lunch_title` (category like "Green", "Local", "World Wide") and
  `.lunch_desc` (the dish text).
- `.lunch_price` carries a uniform price string.

### Restaurang Edison — `https://restaurangedison.se/lunch/`

Same Elementor template as Bricks. Reuses the shared parser.

### Restaurang & Café Inspira — `https://restauranginspira.se/`

Same Elementor template. Leaves `.lunch_price` blank.

### Eatery Lund — `https://eatery.se/anlaggningar/lund`

The landing page only links out; the menu lives in a PDF at
`https://static.thatsup.website/...Lund_sv_V<week>.pdf?v=<bust>`. The
scraper:

1. Fetches the landing page; `parseEateryLanding` picks the first
   `Lund_sv_V*.pdf` href and the early-bird/ordinarie prices.
2. Downloads the PDF.
3. Shells out to `pdftotext -layout - -` (poppler-utils) for text.
4. `parseEateryMenu` walks the text line-by-line; uppercase Swedish day
   names (`MÅNDAG`, …) mark sections; subsequent non-boilerplate lines are
   dishes.

Boilerplate-line patterns live in `isBoilerplate` in `src/scrapers/eatery.ts`
— update if Eatery adds new chrome lines (current rules drop the LUNCH /
MENY / LUND / salladsbuffé / app-rabatt lines).

### Kantin — `https://www.kantinlund.se/`

Plain WordPress. Each day is a `<p>` whose first child is a `<strong>` with
the day name. Two whole-week extras share the paragraph shape and are
prepended to every day's lines:

- "Veckans vegetariska": `<strong>Veckans vegetariska </strong>dish…`
- "Månadens alternativ": `<strong>Månadens alternativ <span style="font-weight:400">dish</span></strong>`
  (dish text lives inside the strong via a non-bold span — match on the
  whole paragraph text, not just `strong.text()`).

Throws `kantin: no day paragraphs found` if nothing parses, so a layout
change shows as an error card instead of an empty menu.

### Troppo — `https://www.troppo.se/lunch`

Webflow site with one weekly menu of 3 dishes available all weekdays. The
parser returns a single `DayMenu` labelled "Hela veckan"; the renderer
treats any non-Swedish-weekday label as a whole-week menu (the
`isWholeWeekMenu` heuristic in `src/render.ts`).

### Laziza — `https://www.laziza.se/lunch/`

Lebanese buffet, no per-day menu — same single "Hela veckan" entry as
Troppo. Price + buffet label are parsed from the page; hours hardcoded for
the Lund branch (Scheelevägen 15K).

## Failure modes & how to tell

`scrapeAll` returns `{ fetchedAt, restaurants }` where each `Restaurant`
that failed carries an `error` field. The renderer shows an inline
"Kunde inte hämta menyn" card in place of the menu, and the CLI prints
`<source>: FAILED — …` to stderr.

Most likely things to break:
- A site redesigns and drops the CSS classes the parser keys on.
- Eatery changes the PDF filename pattern (no longer `Lund_sv_V*.pdf`).
- `pdftotext` is missing on the host (Eatery only).

## Tests

`yarn test` runs `node --test` against TS sources via `ts-node/register`.
Tests live under `tests/` (mirroring `src/`); each scraper has a
`tests/scrapers/<source>.test.ts` that feeds a captured fixture
(`tests/fixtures/<source>.html|.txt`) into the pure parser and asserts
the result deep-equals a stored snapshot (`tests/fixtures/<source>.snap.json`).
To intentionally update a snapshot, delete the `.snap.json` and rerun —
the helper at `tests/fixtures/snapshot.ts` writes a fresh baseline on
first run.

When adding a new scraper:

1. Add `src/scrapers/<name>.ts` exporting `parse<Name>(html | text)` (pure)
   plus a `ScraperDescriptor` const.
2. Append the descriptor to `src/scrapers/index.ts`.
3. Capture a fixture into `tests/fixtures/<name>.html`.
4. Add `tests/scrapers/<name>.test.ts` that calls `parse<Name>` against the
   fixture and `matchSnapshot`.

## Package manager

Use **yarn**, not npm. The project ships with `yarn.lock`; do not introduce
`package-lock.json`. Yarn 4 / PnP is in use (`.pnp.cjs`, `.yarn/`). Editor
SDK shims live in `.yarn/sdks/` — `yarn dlx @yarnpkg/sdks base` regenerates
them; point your editor's tsserver at `.yarn/sdks/typescript/lib/tsserver.js`.

## Conventions

- Single-line commit subjects, no body, no Co-Authored-By trailer.
- Match the user's global `~/.claude/CLAUDE.md`: `AGENTS.md` not
  `CLAUDE.md` for project docs.
- Scrapers throw on primary-parse failure; optional metadata stays
  `undefined` rather than throwing.
- Day names: import from `src/hours.ts`, don't redeclare.
- Whitespace + zero-width normalisation: `cleanText` in
  `src/scrapers/lib.ts`.
