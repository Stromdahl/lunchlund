import test from "node:test";
import assert from "node:assert/strict";
import { kantinClosure, parseKantin, resolveKantin } from "../../src/scrapers/kantin";
import { matchSnapshot, readFixture } from "../fixtures/snapshot";

const onDay = (iso: string) => new Date(`${iso}T12:00:00+02:00`);

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

// Summer-shutdown week: the page shows "Semesterstängt 26/6-9/8" above the
// reopening-week menu ("Meny 10/8 – 14/8"). During the window the restaurant is
// closed, so we must NOT present the August dishes as today's lunch. Regression
// guard for the live page captured 2026-06-27 (issue: closed but a menu shown).
test("resolveKantin reports closed during the summer window", () => {
  const html = readFixture("kantin-summer.html");
  const data = resolveKantin(html, onDay("2026-06-27"));
  assert.deepEqual(data.menu, [], "no menu while closed");
  assert.equal(data.hours, undefined, "no hours while closed → 'Stängt idag'");
  assert.equal(data.closed?.note, "Semesterstängt t.o.m. 9/8");
});

// After the window closes, the very same page (banner text may linger) parses
// normally: the August menu is now current, and there's no closed flag.
test("resolveKantin shows the menu once the window has passed", () => {
  const html = readFixture("kantin-summer.html");
  const data = resolveKantin(html, onDay("2026-08-11"));
  assert.equal(data.closed, undefined, "not closed after reopening");
  assert.ok(data.menu.length > 0, "menu is shown");
  const monday = data.menu.find((d) => d.day === "Måndag");
  assert.ok(monday, "Monday present in the reopening-week menu");
});

// The closure banner is only read when present: a normal menu page has none.
test("kantinClosure returns null on a normal menu page", () => {
  assert.equal(kantinClosure(readFixture("kantin.html")), null);
});

test("parseKantin throws when no day paragraphs are present", () => {
  assert.throws(
    () => parseKantin("<html><body><h1>Meny</h1></body></html>"),
    /kantin: no day paragraphs found/,
  );
});

// Kantin's editor started closing the bold day label with a <br> instead of a
// trailing space ("<strong>Måndag<br /></strong>Kalv tri-tip"), which glues the
// label to the dish in the paragraph's text and defeated the old `^Måndag\b`
// match — every day paragraph was skipped and the scraper threw "no day
// paragraphs found". Regression guard for the live page captured 2026-09-01.
test("parseKantin matches snapshot (day label glued to dish by <br>)", () => {
  const html = readFixture("kantin-br.html");
  const data = parseKantin(html);
  assert.equal(data.note, "Meny 31/8 – 4/9");
  assert.deepEqual(
    data.menu.map((d) => d.day),
    ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag"],
  );
  // The colon-and-<br> extras heading ("Veckans vegetariska:<br>") is picked up
  // and prepended to every open day.
  assert.ok(
    data.menu[0].lines[0].startsWith("Veckans vegetariska: Rostad spetskål"),
    "weekly veg extra leads each day",
  );
  matchSnapshot("kantin-br", data);
});

// The glue tolerance must not swallow a compound word that merely starts with a
// day name — "Fredagsmys" is a dish heading, not Friday's label.
test("parseKantin does not read a day-prefixed compound as a day label", () => {
  const html = `<html><body>
    <h1>Meny 31/8 – 4/9</h1>
    <p><strong>Fredagsmys</strong> Tacobuffé</p>
    <p><strong>Måndag<br /></strong>Köttbullar</p>
  </body></html>`;
  const { menu } = parseKantin(html);
  assert.deepEqual(menu.map((d) => d.day), ["Måndag"]);
  assert.deepEqual(menu[0].lines, ["Köttbullar"]);
});
