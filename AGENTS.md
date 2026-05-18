# Agent notes — lunchlund

## What this is

A small TypeScript tool that scrapes two restaurants on Mobilvägen, Lund —
Bricks Eatery (Mobilvägen 12) and Eatery Lund (Mobilvägen 4) — and writes
`dist/index.html`. Designed to be cron-run and published as a static page.

## Data sources

### Bricks Eatery — `https://brickseatery.se/`

WordPress / Elementor page with the weekly menu inline. The scraper relies
on these markers:

- `<h2 class="week">` — e.g. "Lunchmeny V21", used as the restaurant's note.
- Per-day containers with class `monday` / `tuesday` / `wednesday` /
  `thursday` / `friday` (lowercase English).
- Inside each day, one `<div class="lunchmeny_container">` per dish, with
  `.lunch_title` (category like "Green", "Local", "World wide") and
  `.lunch_desc` (the actual dish text).

### Eatery Lund — `https://eatery.se/anlaggningar/lund`

The page itself only links out; the menu lives in a PDF at
`https://static.thatsup.website/...Lund_sv_V<week>.pdf?v=<bust>`. The
scraper:

1. Fetches the page and picks the first `Lund_sv_V*.pdf` href.
2. Downloads the PDF.
3. Shells out to `pdftotext -layout - -` (poppler-utils) for text.
4. Walks the text line-by-line; uppercase Swedish day names (`MÅNDAG`, …)
   mark sections; subsequent non-boilerplate lines are dishes.

Boilerplate-line patterns live in `isBoilerplate` in `src/scrapers/eatery.ts`
— update if Eatery adds new chrome lines (current rules drop the LUNCH /
MENY / LUND / salladsbuffé / app-rabatt lines).

## Failure modes & how to tell

`scrapeAll` returns `{ restaurants, errors }`; failures from one source do
not break the other. The rendered HTML shows a red box at the top listing
which source failed, and the CLI prints `<source>: FAILED — …` to stderr.

Most likely things to break:
- Bricks redesigns and drops the `.monday`/`.lunchmeny_container` classes.
- Eatery changes the PDF filename pattern (no longer `Lund_sv_V*.pdf`).
- `pdftotext` is missing on the host.

There are no tests yet — verify by running `yarn build` and eyeballing
`dist/index.html`.

## Package manager

Use **yarn**, not npm. The project ships with `yarn.lock`; do not introduce
`package-lock.json`. Yarn 4 / PnP is in use (`.pnp.cjs`, `.yarn/`).

## Conventions

- Single-line commit subjects, no body, no Co-Authored-By trailer.
- Match the user's global `~/.claude/CLAUDE.md`: `AGENTS.md` not
  `CLAUDE.md` for project docs.
