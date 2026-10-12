import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEateryMenu,
  parseEateryItems,
  parseEateryPrice,
  parseEateryWeek,
} from "../../src/scrapers/eatery";
import { matchSnapshot, readFixture } from "../fixtures/snapshot";

// Fixtures are trimmed Firestore REST responses from Pej Menu Display, week 42
// of 2026: the organisation document (just a decoy "kista-gate" menu and the
// "lund" one) and a batchGet of that week's dishes (plus one `missing` entry).
const org = () => JSON.parse(readFixture("eatery-pej-org.json"));
const items = () => parseEateryItems(JSON.parse(readFixture("eatery-pej-items.json")));
const MONDAY_W42 = new Date("2026-10-12T08:00:00Z");

test("eatery reads the week's Pej menu (matches snapshot)", () => {
  const week = parseEateryWeek(org(), MONDAY_W42);
  matchSnapshot("eatery-pej", { note: week.note, menu: buildEateryMenu(week, items()) });
});

test("parseEateryWeek takes Mon–Fri of the current ISO week, from the lund menu only", () => {
  const week = parseEateryWeek(org(), MONDAY_W42);
  assert.equal(week.note, "Lunchmeny V42");
  assert.deepEqual(week.days.map((d) => d.day), ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag"]);
  const ids = week.days.flatMap((d) => d.itemIds);
  assert.ok(!ids.includes("kistaItem"), "another site's menu leaked in");
  assert.ok(!ids.includes("lastWeekItem"), "last week's entry leaked in");
});

// A weekend build still shows the week just served, not next week's.
test("parseEateryWeek on a Saturday reads that same week", () => {
  const week = parseEateryWeek(org(), new Date("2026-10-17T10:00:00Z"));
  assert.equal(week.note, "Lunchmeny V42");
  assert.equal(week.days.length, 5);
});

// 22:30 UTC Sunday is 00:30 Monday in Stockholm: the week is judged on Lund's
// calendar, so this is already week 43 — which the fixture has no entries for.
test("parseEateryWeek judges the week in Europe/Stockholm", () => {
  const week = parseEateryWeek(org(), new Date("2026-10-18T22:30:00Z"));
  assert.equal(week.note, "Lunchmeny V43");
  assert.deepEqual(week.days, []);
  assert.throws(() => buildEateryMenu(week, items()), /no dishes for Lunchmeny V43/);
});

test("parseEateryWeek throws when Pej no longer has a lund menu", () => {
  const doc = org();
  doc.fields.menus.arrayValue.values.pop();
  assert.throws(() => parseEateryWeek(doc, MONDAY_W42), /no "lund" menu/);
});

test("parseEateryItems skips documents batchGet reports missing", () => {
  const map = items();
  assert.equal(map.size, 15);
  assert.deepEqual(map.get("8R8lSXFoilPo4L25v02N"), {
    name: "Citron- och rosmarinbakad kyckling",
    description: "potatismos, rosmarinsky och gröna bönor med bakad lök",
  });
});

test("buildEateryMenu marks a closed weekday and drops unresolved dishes", () => {
  const menu = buildEateryMenu(
    {
      note: "Lunchmeny V52",
      days: [
        { day: "Torsdag", itemIds: [], closed: true },
        { day: "Fredag", itemIds: ["8R8lSXFoilPo4L25v02N", "goneItem"], closed: false },
      ],
    },
    items(),
  );
  assert.deepEqual(menu, [
    { day: "Torsdag", lines: ["Stängt"] },
    {
      day: "Fredag",
      lines: ["Citron- och rosmarinbakad kyckling — potatismos, rosmarinsky och gröna bönor med bakad lök"],
    },
  ]);
});

test("parseEateryPrice joins the ordinarie and early-bird prices", () => {
  assert.equal(
    parseEateryPrice(readFixture("eatery-landing.html")),
    "139kr (early-bird 132kr 11:00 - 11:30)",
  );
  assert.equal(parseEateryPrice("<html><body><p>Välkommen</p></body></html>"), undefined);
});
