import test from "node:test";
import { parseTroppo } from "../../src/scrapers/troppo";
import { matchSnapshot, readFixture } from "../fixtures/snapshot";

test("parseTroppo matches snapshot", () => {
  const html = readFixture("troppo.html");
  matchSnapshot("troppo", parseTroppo(html));
});
