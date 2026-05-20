import test from "node:test";
import assert from "node:assert/strict";
import { parseKantin } from "../../src/scrapers/kantin";
import { matchSnapshot, readFixture } from "../fixtures/snapshot";

test("parseKantin matches snapshot", () => {
  const html = readFixture("kantin.html");
  matchSnapshot("kantin", parseKantin(html));
});

test("parseKantin throws when no day paragraphs are present", () => {
  assert.throws(
    () => parseKantin("<html><body><h1>Meny</h1></body></html>"),
    /kantin: no day paragraphs found/,
  );
});
