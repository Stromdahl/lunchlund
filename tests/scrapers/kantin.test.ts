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

// Holiday week: Kantin closes Friday ("fredag – Midsommarstängt"). A closed
// day shouldn't list the weekly veg / månadens extras above the "stängt" note.
// Regression guard for the midsummer week of 2026-06-15.
test("parseKantin leaves a closed day's line standing alone", () => {
  const html = readFixture("kantin-closed.html");
  const { menu } = parseKantin(html);
  const friday = menu.find((d) => d.day === "Fredag");
  assert.ok(friday, "Friday should be present");
  assert.deepEqual(friday!.lines, ["Midsommarstängt"]);
  // Open days still carry the prepended extras.
  const monday = menu.find((d) => d.day === "Måndag");
  assert.ok(monday && monday.lines.length > 1, "Monday keeps its extras");
  matchSnapshot("kantin-closed", parseKantin(html));
});

test("parseKantin throws when no day paragraphs are present", () => {
  assert.throws(
    () => parseKantin("<html><body><h1>Meny</h1></body></html>"),
    /kantin: no day paragraphs found/,
  );
});
