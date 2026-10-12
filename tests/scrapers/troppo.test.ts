import test from "node:test";
import { parseTroppo } from "../../src/scrapers/troppo";
import { matchSnapshot, readFixture } from "../fixtures/snapshot";

test("parseTroppo matches snapshot", () => {
  const html = readFixture("troppo.html");
  matchSnapshot("troppo", parseTroppo(html));
});

// Troppo added Saturday lunch in October 2026 and renamed the menu heading
// from "Monday-Friday" to "Monday-Saturday" — that broke the 2026-10-12 build.
test("parseTroppo matches snapshot (Monday-Saturday heading)", () => {
  const html = readFixture("troppo-saturday.html");
  matchSnapshot("troppo-saturday", parseTroppo(html));
});
