import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { scrapeAll } from "./scrape";
import { render } from "./render";
import { renderJson, renderRss } from "./feeds";
import { SCRAPERS } from "./scrapers";

type Args = { outDir: string; cache?: string };

function parseArgs(argv: string[]): Args {
  const args: Args = { outDir: "dist" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out" || a === "-o") args.outDir = argv[++i];
    else if (a === "--cache") args.cache = argv[++i];
    else if (a === "--help" || a === "-h") {
      const sources = SCRAPERS.map(
        (s) => `  ${s.id.padEnd(8)} ${s.name} — ${s.address}`,
      ).join("\n");
      console.log(
        [
          "lunchlund — scrape lunch menus for Mobilvägen 10 neighbours",
          "",
          "Usage: lunchlund [--out DIR] [--cache FILE]",
          "",
          "  --out, -o DIR   Output directory (default: dist)",
          "  --cache FILE    Previous lunchlund.json used as fallback when a scraper",
          "                  fails (default: <out>/lunchlund.json)",
          "",
          "Sources:",
          sources,
        ].join("\n"),
      );
      process.exit(0);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const outDir = resolve(process.cwd(), args.outDir);
  const cachePath = args.cache
    ? resolve(process.cwd(), args.cache)
    : resolve(outDir, "lunchlund.json");

  console.error("scraping…");
  const result = await scrapeAll(cachePath);
  for (const r of result.restaurants) {
    if (r.error) {
      console.error(`  ${r.error.source}: FAILED — ${r.error.error}`);
    } else {
      console.error(`  ${r.name}: ${r.menu.length} day(s)`);
    }
  }

  await mkdir(outDir, { recursive: true });

  const files: [string, string][] = [
    ["index.html", render(result)],
    ["lunchlund.json", renderJson(result)],
    ["lunchlund.xml", renderRss(result)],
  ];
  for (const [name, body] of files) {
    const p = resolve(outDir, name);
    await writeFile(p, body, "utf8");
    console.error(`wrote ${p}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
