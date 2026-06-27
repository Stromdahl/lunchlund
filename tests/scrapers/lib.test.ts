import test from "node:test";
import assert from "node:assert/strict";
import { isClosedNow, parseClosurePeriod } from "../../src/scrapers/lib";

// A Stockholm-local date for the given Y-M-D at noon (well clear of any
// midnight/UTC-offset boundary, so the month/day read is unambiguous).
const onDay = (y: number, m: number, d: number) =>
  new Date(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T12:00:00+02:00`);

test("parseClosurePeriod reads the live Kantin banner shape", () => {
  const p = parseClosurePeriod("Semesterstängt 26/6-9/8 GLAD SOMMAR");
  assert.deepEqual(p, {
    start: { month: 6, day: 26 },
    end: { month: 8, day: 9 },
    label: "Semesterstängt",
  });
});

test("parseClosurePeriod accepts en-dash, spaces, and other closure words", () => {
  assert.deepEqual(parseClosurePeriod("Sommarstängt 7/7 – 4/8")?.label, "Sommarstängt");
  assert.deepEqual(parseClosurePeriod("Stängt 1/7-31/7")?.label, "Stängt");
  const p = parseClosurePeriod("Sommarstängt 7/7 – 4/8");
  assert.deepEqual(p?.start, { month: 7, day: 7 });
  assert.deepEqual(p?.end, { month: 8, day: 4 });
});

test("parseClosurePeriod ignores a date range with no closure word", () => {
  assert.equal(parseClosurePeriod("Meny 10/8 – 14/8"), null);
  assert.equal(parseClosurePeriod("Måndag till fredag kl. 11–16"), null);
});

test("parseClosurePeriod rejects an out-of-range date", () => {
  assert.equal(parseClosurePeriod("Stängt 32/6-9/8"), null);
  assert.equal(parseClosurePeriod("Stängt 1/13-9/8"), null);
});

test("isClosedNow covers the window inclusively and expires after it", () => {
  const p = parseClosurePeriod("Semesterstängt 26/6-9/8")!;
  assert.equal(isClosedNow(p, onDay(2026, 6, 25)), false, "day before");
  assert.equal(isClosedNow(p, onDay(2026, 6, 26)), true, "first day");
  assert.equal(isClosedNow(p, onDay(2026, 6, 27)), true, "mid-window (today)");
  assert.equal(isClosedNow(p, onDay(2026, 8, 9)), true, "last day");
  assert.equal(isClosedNow(p, onDay(2026, 8, 10)), false, "reopening day");
  // Banner left up after reopening must not re-close the restaurant.
  assert.equal(isClosedNow(p, onDay(2026, 9, 1)), false, "well after");
});

test("isClosedNow handles a window wrapping the year end", () => {
  const p = parseClosurePeriod("Stängt 27/12-6/1")!;
  assert.equal(isClosedNow(p, onDay(2026, 12, 31)), true);
  assert.equal(isClosedNow(p, onDay(2026, 1, 3)), true);
  assert.equal(isClosedNow(p, onDay(2026, 6, 1)), false);
});
