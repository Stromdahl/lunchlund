# Agent notes — lunchlund

## What this is

A small TypeScript tool that scrapes lunch menus from seven restaurants near
Mobilvägen 10 in Lund (Ideon / Brunnshög) and writes `dist/index.html`,
`dist/lunchlund.json`, and `dist/lunchlund.xml` (RSS). Designed to be
cron-run and published as a static page.

## Architecture

Each scraper exports a **descriptor** (`ScraperDescriptor` in `src/types.ts`)
that owns the restaurant's identity (id, name, address, `walkMinutes`, website)
and a `scrape()` function returning `ScrapedData` (the parsed pieces: note,
price, menu, hours). `walkMinutes` is a static estimate of the walk
from Mobilvägen 10 (decided once, not scraped), measured on the OSM pedestrian
network (geocode each address via Nominatim, route via the `routed-foot` OSRM
profile, round `duration` to minutes). The renderer links each address to a
Google Maps pin and shows the time next to it as "ca N min" — recompute if a
restaurant moves. `src/scrapers/index.ts` collects all descriptors into one
`SCRAPERS` array; `src/scrape.ts` runs them in parallel and merges identity
+ scraped data into the final `Restaurant[]`. A scraper failure attaches an
`error: { source, error }` to the still-rendered card.

Each scraper file is split into a **pure parser** and a thin **fetch + parse
wrapper** invoked by the descriptor. The parser takes a raw HTML/text string
and returns `ScrapedData` — that makes it testable without network I/O.
Shared helpers live in `src/scrapers/lib.ts` (`fetchText`, `fetchJson`,
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

Since 2026-10 the menu is no longer a weekly PDF: eatery.se's "Lunchmeny"
button links to Pej Menu Display (`https://menu.pej.io/ea/menus/lund`), an
Angular app that reads Google Firestore in the browser. Pej has no public API
(checked 2026-10-12), so the scraper reads the same documents over the
Firestore REST API with the web API key the app ships:

1. GET `organizations/yKtLIyA7nVuIA6Xh9f8k` (Eatery, slug `ea`) with
   `mask.fieldPaths=menus`. `menus[]` holds every Eatery site; ours has slug
   `lund` and `entries` keyed `YYYY-MM-DD`, each with
   `informationBlocks[].libraryItemId` or `status: "Closed"`. The document is
   ~1.5 MB because it carries all sites' full history.
2. `parseEateryWeek` takes Mon–Fri of the current ISO week (judged in
   Europe/Stockholm) and collects item ids.
3. One `:batchGet` of `organizations/<id>/items/<itemId>` — dish text is in
   `name.sv` / `description.sv`.
4. `buildEateryMenu` joins them (`Name — description`; a closed day reads
   "Stängt") and throws if the week has no dishes.

The price (early-bird/ordinarie) still comes from the eatery.se landing page
via `parseEateryPrice`; that fetch is optional and can't fail the card.

The Pej data model is internal and can change without notice — that's the
likeliest break. If it does, open the menu page in a browser and watch the
Firestore `Listen` requests to see the current collection/field names.
Fixtures (`eatery-pej-org.json`, `eatery-pej-items.json`) are trimmed REST
responses for week 42 of 2026.

### Kantin — `https://www.kantinlund.se/`

Plain WordPress. Each day is a `<p>` whose **leading bold text** is a day
label. The parser finds the bold (`<strong>` or `<b>`) anywhere in the
paragraph (not just as a direct child) and requires its text to lead the
paragraph — that tolerates the observed shapes and skips bold body content
that doesn't lead with a day (e.g. the theme's "Måndag till fredag kl. 11–16"
hours line and the contact line's `<b>info@…</b>` email):

- Hand-typed: `<strong>Måndag </strong>dish…` (capitalised, dish follows).
- Pasted from webmail: `<p><span…><strong>måndag</strong> – dish…</span></p>`
  — the strong is buried in nested `oneComWebmail-*` `<span>`s, the day name
  is lowercased, and an en-dash separates the dish. (This layout broke the
  2026-06-01 cron run.)
- Bold closed by a line break: `<strong>Måndag<br /></strong>dish…`. cheerio's
  `.text()` drops the `<br>`, so the paragraph reads `MåndagKalv tri-tip` with
  **no separator at all**. (This broke the 2026-09-01 build — every day
  paragraph was skipped and the scraper threw "no day paragraphs found".)

- Days in webmail-pasted `<div>`s instead of `<p>`s (2026-10-12):
  `<div><b>Måndag</b><br>dish<br><br><b>Tisdag</b></div><div>dish</div>` — one
  div can hold a day's dish *and* the next day's label. When the `<p>` pass
  finds no days, `parseDayStream` flattens the page into visual lines (split at
  `<br>` and block edges, remembering each line's leading bold run) and reads
  them in order: a bold day label opens a day (bold text after the label, e.g.
  "Torsdag – råbiffstorsdag", becomes a "Råbiffstorsdag:" prefix), plain lines
  after it are the dish, ended by a blank line or block edge once a dish is
  seen, a heading, or the next label. Fixture: `kantin-div.html`.

`matchLabel`/`stripLabel` handle the three `<p>` shapes: a label matches when it leads the
paragraph and the next character is not a lowercase letter (so the glued form
is accepted but a compound like "Fredagsmys" is not), and the strip consumes
any following run of whitespace, colon, or hyphen/dash variant. The guard is a
character test rather than a regex lookahead because the `/i` flag would make a
lowercase class match uppercase too — rejecting the very `MåndagKalv` shape it
exists to catch. All three shapes — plus `<b>` labels and a colon separator —
have fixture-backed snapshots (`kantin.html`, `kantin-webmail.html`,
`kantin-br.html`).

Two whole-week extras share the paragraph shape and are prepended to every
day's lines:

- "Veckans vegetariska": `<strong>Veckans vegetariska </strong>dish…`
- "Månadens alternativ": `<strong>Månadens alternativ <span style="font-weight:400">dish</span></strong>`
  (dish text lives inside the strong via a non-bold span — match on the
  whole paragraph text, not just `strong.text()`).

Throws `kantin: no day paragraphs found` if nothing parses, so a layout
change shows as an error card instead of an empty menu.

**Summer/holiday closure.** During a shutdown Kantin keeps the *reopening*
week's menu published, under a heading banner like
`Semesterstängt 26/6-9/8` — so a naive parse shows dishes the kitchen isn't
serving (the bug from 2026-06-27). `kantinClosure` reads that banner and
`resolveKantin(html, now)` returns a closed entry (empty `menu`, no `hours`,
a `closed: { note }`) when today falls in the window, so the card reads
"Stängt idag" instead. The window parser (`parseClosurePeriod`) and
"is today inside it?" check (`isClosedNow`) are **shared helpers in
`scrapers/lib.ts`** — wire them into other scrapers as those sites post their
own summer banners (none did as of 2026-06-27). Closures compare by
(month, day) so the window auto-expires once today passes `end`, even if the
banner text lingers after reopening. Note: `closed` does not survive the
last-known-good fallback (empty `menu` fails its `prev.menu?.length` guard),
so a *failed* build mid-closure falls back to an error card — transient,
self-heals on the next successful build.

Tripwire for the case this does NOT catch — a restaurant that closes
*silently*, just leaving last week's menu up with no banner. The menu's
week heading (Kantin's `note`, the elementor sites' "Lunchmeny V21") is the
signal there: a declared week that isn't the current ISO week. (Eatery is
immune: Pej entries are dated, so last week's dishes are never read.) Not built — restaurants legitimately post next week's menu
late in the current week, so a hard week-mismatch block would hide it.

### Troppo — `https://www.troppo.se/lunch`

Webflow site with one weekly menu of 3 dishes available all weekdays. The
menu block follows an h2 whose wording is hand-edited churn — "Monday-Friday",
then "Monday-Saturday" and "SATURDAY-FRIDAY LUnch Menu" on the same day once
Troppo started Saturday lunch (2026-10) — so `MENU_HEADING` accepts "Lunch
Menu" or any English day-to-day range. Each dish is a `<strong>` name
followed by `<br>`-separated description lines up to a blank line or an "or"
divider — sometimes wrapped in `<em>`, sometimes plain text, so
`descriptionAfter` reads text nodes rather than keying on `<em>`. The
parser returns a single `DayMenu` labelled "Hela veckan"; the renderer
treats any non-Swedish-weekday label as a whole-week menu (the
`isWholeWeekMenu` heuristic in `src/render.ts`).

### Laziza — `https://www.laziza.se/lunch/`

Lebanese buffet, no per-day menu — same single "Hela veckan" entry as
Troppo. Price + buffet label are parsed from the page; hours hardcoded for
the Lund branch (Scheelevägen 15K).

### Aiko Sushi Brunnshög — `https://www.aikosushi.se/lunch`

Fixed Mon–Fri lunch offering with four category sections (Sushi, Sushi Dog,
Varmrätter, Poké Bowls) and per-portion price tables. Modelled as a single
"Hela veckan" entry. The parser verifies the four section H2s exist and
captures the "Inkl. misosoppa, vatten & kaffe" note; the line strings are
curated since the page is mostly fixed copy + price tables. Throws if the
"Lunch Erbjudande" header or any category section H2 disappears.

## Resilience

Three layers soften a scrape failure, in order of how much they help the
person looking at the live page:

1. **Last-known-good fallback** (`src/scrape.ts`). When a scraper fails,
   `scrapeAll` reads the previous run's `lunchlund.json` from local disk (`loadCache(path)`; `--cache FILE`, default `<out>/lunchlund.json`) and reuses that restaurant's last menu instead of showing nothing. Guard:
   the cached entry must carry a real menu fetched in the **same ISO week**
   (a menu is weekly, so same-week data is still right; last week's is not).
   Each entry carries `asOf` (the time it was actually fetched successfully);
   on fallback the menu and its original `asOf` are preserved verbatim, so the
   chain survives repeated failed builds without ever looking fresh, and the
   week-boundary guard still fires. Rendered as a normal card plus a muted
   "Kunde inte uppdatera idag — visar menyn från <date>" note (`.stale-note`,
   `stale: true`). The cache load never throws: a missing/garbage/unreachable
   cache → no fallback → the plain error card (the old behaviour). The pure
   merge lives in `resolveRestaurant` (unit-tested in `tests/scrape.test.ts`).
   This is the only layer that changes what a user sees on an *already-baked*
   failed build — 2 and 3 only reduce how often a build fails.
2. **Browser-ish request headers** (`src/scrapers/lib.ts`). Fetches send a
   real-browser `user-agent` + `accept`/`accept-language` instead of the bare
   `lunchlund/0.1` UA, on the theory that the nightly `415` is a WAF canned
   response to a non-browser client (it's a GET with no body — not real
   content negotiation). Plausible but unproven; a daytime success proves
   nothing since daytime worked before too. Dial back if a host objects.
3. **Retry with backoff** (`src/scrapers/lib.ts`, `fetchOk`). Network errors,
   timeouts, and transient HTTP (`408/425/429/5xx`) are retried up to 3× with
   a 400/800 ms backoff and a 15 s per-attempt timeout. `415` is intentionally
   **not** retried — it won't change seconds later; headers are its lever.

## Failure modes & how to tell

`scrapeAll` returns `{ fetchedAt, restaurants }` where each `Restaurant`
that failed carries an `error` field. If a same-ISO-week menu was cached, the
card still shows it (`stale: true`, plus the "kunde inte uppdatera" note);
otherwise the renderer shows the inline "Kunde inte hämta menyn" card in place
of the menu. Either way the CLI prints `<source>: FAILED — …` to stderr.

Most likely things to break:
- A site redesigns and drops the CSS classes the parser keys on.
- Pej changes its Firestore layout (Eatery) — see the Eatery section.
- The scheduled build lands in a nightly window (~00:00–02:00 Stockholm,
  observed 2026-06-03…05) where the hosts reject requests: `503` from
  one.com (Kantin, Laziza), `415` from GlobalConnect (Bricks, Edison,
  Inspira, Aiko). Daytime runs from the same GitHub runners were fine,
  so it's host-side and time-correlated — but the cause (maintenance vs.
  bot mitigation) is unconfirmed. The cron is at 03:17 Stockholm to stay
  clear; the last-known-good fallback now keeps a same-week menu on the page
  through such a window instead of an error card, but a `gh workflow run
  build.yml` during the day still gets *fresh* menus and repopulates the cache
  (in-build retries alone won't outlast a multi-hour window). Recurring 03:17
  failures would point at IP-based blocking instead. Note the fallback can
  only show what the last *successful* build cached — if every build in a
  week's run failed, there's nothing same-week to fall back to.
- **The scheduled build stops running at all.** GitHub disables a workflow's
  `schedule:` triggers after 60 days without repo activity. That happened on
  2026-08-27 (last commit 2026-06-27) and the page silently served week-35
  menus into September — no error cards, nothing wrong-looking, just old food.
  This repo goes months between commits, so it will recur. `gh workflow list
  --all` shows the state (`disabled_inactivity`); `gh workflow enable
  "Build and deploy"` turns it back on. **Check this before debugging a
  scraper** whenever the page looks stale.

  The page now says so itself: the inline script counts the weekdays between
  the build date and today (Europe/Stockholm) and injects a `.page-stale`
  banner into the header when that count is ≥ 1. It's deliberately *not* a
  plain date comparison — Friday's build is correct content all weekend, and a
  banner that cried stale every Saturday would be ignored by the Monday it
  finally mattered. Being client-side, it's invisible with JS off; the
  `render.test.ts` stale-banner tests run the real inline script against a DOM
  stub with the clock pinned.

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

## Nix

`flake.nix` exports `packages.x86_64-linux.default` (executable `lunchlund`,
built by `package.nix`) and the same package under `checks`. It uses
nixpkgs' `yarn-berry_4.fetchYarnBerryDeps` + `yarnBerryConfigHook`, compiles
with `yarn compile` (tsc → `dist-js/`), runs `yarn test` in `checkPhase` (a red
test fails `nix build`), and wraps `node --require .pnp.cjs dist-js/index.js`.

- `nixosModules.default` (`nix/module.nix`) is `services.lunchlund`; options
  are documented in the README. `checks` also holds `module` (eval-time
  assertions on the unit, `nix/module-check.nix`) and `module-vm` (a NixOS VM
  test with a stub binary: atomic publish, `--cache` chaining, a failed run
  keeps `current`, web server group can read; plus the real package offline,
  which publishes error cards and exits 0; `nix/module-vm-test.nix`, about
  90 s without KVM).
- **Changed `yarn.lock`?** The offline-cache hash in `package.nix` goes stale
  (the build fails with "fetchYarnDeps hash is out of date"). Set it to
  `lib.fakeHash`, run `nix build`, paste the `got:` hash.
- The flake only sees git-tracked files: `git add` new files before building.
- New top-level files the build needs must be added to the `fileset` in
  `package.nix`.

## Conventions

- Single-line commit subjects, no body, no Co-Authored-By trailer.
- Match the user's global `~/.claude/CLAUDE.md`: `AGENTS.md` not
  `CLAUDE.md` for project docs.
- Scrapers throw on primary-parse failure; optional metadata stays
  `undefined` rather than throwing.
- Day names: import from `src/hours.ts`, don't redeclare.
- Whitespace + zero-width normalisation: `cleanText` in
  `src/scrapers/lib.ts`.
