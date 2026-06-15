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

// The closed-day suppression keys on the "stängt" stem anywhere in the line,
// not on the specific word "Midsommarstängt" from the fixture. This pins that
// broader behaviour (e.g. "Helgstängt") so the heuristic in #8 stays covered.
test("parseKantin suppresses extras for any 'stängt' wording", () => {
  const html = `<html><body>
    <h1>Meny 15/6 – 18/6</h1>
    <p><strong>Veckans vegetariska</strong> Linsgryta</p>
    <p><strong>Månadens alternativ</strong> Varmrökt lax</p>
    <p><strong>Måndag</strong> Köttbullar</p>
    <p><strong>Fredag</strong> – Helgstängt</p>
  </body></html>`;
  const { menu } = parseKantin(html);
  const friday = menu.find((d) => d.day === "Fredag");
  assert.deepEqual(friday!.lines, ["Helgstängt"], "closed day stands alone");
  const monday = menu.find((d) => d.day === "Måndag");
  assert.equal(monday!.lines.length, 3, "open day keeps its two extras");
});

// #8: closed days worded WITHOUT the "stängt" stem are now detected too, so
// they stand alone instead of listing veg / månadens dishes above a closed
// note. Covers the public-holiday labels (helgdag / röd dag) and the explicit
// no-service wording ("ingen lunch") called out in the issue.
test("parseKantin suppresses extras for non-'stängt' closed-day wordings (#8)", () => {
  for (const note of ["Helgdag", "Röd dag", "ingen lunch"]) {
    const html = `<html><body>
      <h1>Meny 15/6 – 18/6</h1>
      <p><strong>Veckans vegetariska</strong> Linsgryta</p>
      <p><strong>Månadens alternativ</strong> Varmrökt lax</p>
      <p><strong>Måndag</strong> Köttbullar</p>
      <p><strong>Fredag</strong> – ${note}</p>
    </body></html>`;
    const { menu } = parseKantin(html);
    const friday = menu.find((d) => d.day === "Fredag");
    assert.deepEqual(friday!.lines, [note], `closed day "${note}" stands alone`);
    const monday = menu.find((d) => d.day === "Måndag");
    assert.equal(monday!.lines.length, 3, "open day still keeps its two extras");
  }
});

// Boundary of the #8 broadening: a bare "Klämdag" is NOT treated as closed — a
// bridge day can still serve lunch, so its extras are kept. A klämdag that is
// actually closed says so via the other stems ("Klämdag – ingen lunch"), which
// CLOSED_DAY does catch. Tripwire — revisit if a bare-klämdag closed day surfaces.
test("parseKantin keeps extras on a bare 'klämdag' (may still serve)", () => {
  const html = `<html><body>
    <h1>Meny 15/6 – 18/6</h1>
    <p><strong>Veckans vegetariska</strong> Linsgryta</p>
    <p><strong>Månadens alternativ</strong> Varmrökt lax</p>
    <p><strong>Fredag</strong> – Klämdag</p>
  </body></html>`;
  const { menu } = parseKantin(html);
  const friday = menu.find((d) => d.day === "Fredag");
  assert.equal(friday!.lines.length, 3, "bare klämdag keeps its two extras");
  assert.equal(friday!.lines.at(-1), "Klämdag");
});

// The holiday stems carry a "not a letter" guard, so a real dish that merely
// starts with them — "Röd dagsfärsk lax", or a "helgdagsöppet" (open on
// holidays) note — is NOT read as closed and keeps its extras. The glued-vowel
// variants ("Helgdagöppet", "Röd dagöppet") are the case a plain \b would miss
// (JS \b doesn't fire before å/ä/ö), so they pin the lookahead specifically.
// Guards a future-menu false positive the snapshots can't see (they depend on
// text we haven't scraped yet).
test("parseKantin keeps extras when a holiday stem is only a word prefix", () => {
  for (const dish of [
    "Röd dagsfärsk lax",
    "Helgdagsöppet som vanligt",
    "Helgdagöppet",
    "Röd dagöppet som vanligt",
  ]) {
    const html = `<html><body>
      <h1>Meny 15/6 – 18/6</h1>
      <p><strong>Veckans vegetariska</strong> Linsgryta</p>
      <p><strong>Månadens alternativ</strong> Varmrökt lax</p>
      <p><strong>Fredag</strong> ${dish}</p>
    </body></html>`;
    const { menu } = parseKantin(html);
    const friday = menu.find((d) => d.day === "Fredag");
    assert.equal(friday!.lines.length, 3, `"${dish}" stays open, keeps extras`);
    assert.equal(friday!.lines.at(-1), dish);
  }
});

test("parseKantin throws when no day paragraphs are present", () => {
  assert.throws(
    () => parseKantin("<html><body><h1>Meny</h1></body></html>"),
    /kantin: no day paragraphs found/,
  );
});
