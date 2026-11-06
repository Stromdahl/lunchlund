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
- `--cache FILE` — previous `lunchlund.json` to fall back on when a scraper
  fails (default `<out>/lunchlund.json`, so two `yarn build` runs in a row
  chain automatically). Missing or malformed files are treated as no cache.

## Requirements

- Node 20+

## NixOS module

The flake exports `nixosModules.default`, which provides
`services.lunchlund`: a sandboxed oneshot (`DynamicUser`) that rebuilds the
page on a systemd timer. It does not configure a web server.

```nix
{
  imports = [ lunchlund.nixosModules.default ];
  services.lunchlund = {
    enable = true;
    schedule = [
      "Mon..Fri 07:15 Europe/Stockholm"
      "Mon..Fri 10:00 Europe/Stockholm"
    ];
  };
  # Serve config.services.lunchlund.outputDir with your web server.
}
```

Options:

- `enable` — run the service and its timer.
- `schedule` — list of systemd `OnCalendar` expressions; qualify them with a
  timezone. The timer is `Persistent`, so a run missed while the host was
  down happens at boot.
- `group` (default `"caddy"`) — the web server's group. The output is
  readable (and writable) by this group only. The group must exist; the
  module doesn't create it.
- `package` (default: this flake's package) — the lunchlund to run.
- `outputDir` (read-only) — `/var/lib/lunchlund/current`, the directory to
  point the web server at. It holds `index.html`, `lunchlund.json` and
  `lunchlund.xml`.

Each run builds into a fresh `/var/lib/lunchlund/build-*` directory, then
atomically repoints the `current` symlink at it and deletes older builds. The
previous `current/lunchlund.json` is passed as `--cache`. A run that exits
non-zero leaves `current` as it was. A scraper failure is not a failed run:
the page is still published with an error card or a same-week fallback.
`/var/lib/lunchlund` is not a systemd `StateDirectory`, because with
`DynamicUser` that would live under `/var/lib/private`, which no web server
can read. See `nix/module.nix`.

Run it by hand with `systemctl start lunchlund`; `systemctl status lunchlund`
shows the last run's log.

## Layout

- `src/scrapers/bricks.ts` — fetches and parses brickseatery.se HTML.
- `src/scrapers/eatery.ts` — reads Eatery's Pej Menu Display data (Firestore
  REST) for the current week, plus the price from eatery.se.
- `src/scrape.ts` — runs both scrapers in parallel and collects errors.
- `src/render.ts` — emits the static HTML (inline CSS, no JS).
- `src/index.ts` — CLI entry point.
- `src/types.ts` — shared types.

To publish, point any static host at `dist/`, or cron the build and rsync
the result.
