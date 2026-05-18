# lunchlund

Scrapes the weekly lunch menus for the two restaurants directly on
Mobilvägen, Lund and writes a self-contained static HTML page.

Sources:

- [brickseatery.se](https://brickseatery.se/) — Bricks Eatery, Mobilvägen 12
- [eatery.se/anlaggningar/lund](https://eatery.se/anlaggningar/lund) — Eatery Lund, Mobilvägen 4 (menu is a weekly PDF)

## Usage

```bash
yarn install
yarn build                 # writes dist/index.html
xdg-open dist/index.html   # or open it in any browser
```

Flags:

- `--out DIR` — change the output directory (default `dist/`).

## Requirements

- Node 20+
- `pdftotext` from `poppler-utils` (Debian/Ubuntu: `sudo apt install poppler-utils`)
  — used to extract the Eatery PDF.

## Layout

- `src/scrapers/bricks.ts` — fetches and parses brickseatery.se HTML.
- `src/scrapers/eatery.ts` — fetches eatery.se, finds the current weekly PDF,
  shells out to `pdftotext -layout`, and parses the resulting text.
- `src/scrape.ts` — runs both scrapers in parallel and collects errors.
- `src/render.ts` — emits the static HTML (inline CSS, no JS).
- `src/index.ts` — CLI entry point.
- `src/types.ts` — shared types.

To publish, point any static host at `dist/`, or cron the build and rsync
the result.
