import test from "node:test";
import assert from "node:assert/strict";
import { parseKantin } from "../../src/scrapers/kantin";
import { matchSnapshot, readFixture } from "../fixtures/snapshot";

test("parseKantin matches snapshot", () => {
  const html = readFixture("kantin.html");
  matchSnapshot("kantin", parseKantin(html));
});

// New layout where menu text is pasted from webmail: the <strong> day label is
// buried in nested oneComWebmail-* <span>s, day names are lowercased, and the
// dish follows an en-dash. Regression guard for the layout change that broke
// the cron run on 2026-06-01.
test("parseKantin matches snapshot (webmail-nested layout)", () => {
  const html = readFixture("kantin-webmail.html");
  matchSnapshot("kantin-webmail", parseKantin(html));
});

test("parseKantin throws when no day paragraphs are present", () => {
  assert.throws(
    () => parseKantin("<html><body><h1>Meny</h1></body></html>"),
    /kantin: no day paragraphs found/,
  );
});
