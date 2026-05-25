import test from "node:test";
import assert from "node:assert/strict";
import { parseAiko } from "../../src/scrapers/aiko";
import { matchSnapshot, readFixture } from "../fixtures/snapshot";

test("parseAiko matches snapshot", () => {
  const html = readFixture("aiko.html");
  matchSnapshot("aiko", parseAiko(html));
});

test("parseAiko throws when the Lunch Erbjudande heading is missing", () => {
  assert.throws(() => parseAiko("<html><body><h1>Hej</h1></body></html>"), /aiko/);
});
