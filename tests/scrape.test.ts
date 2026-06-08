import test from "node:test";
import assert from "node:assert/strict";
import { resolveRestaurant } from "../src/scrape";
import { Restaurant, ScrapedData, ScraperDescriptor } from "../src/types";

const desc: ScraperDescriptor = {
  id: "x",
  name: "Testaurang",
  address: "Mobilvägen 1",
  website: "https://x.test/",
  scrape: async () => ({ menu: [] }),
};

const now = new Date("2026-06-10T08:00:00Z");
const ok = (v: ScrapedData): PromiseSettledResult<ScrapedData> => ({
  status: "fulfilled",
  value: v,
});
const fail = (msg: string): PromiseSettledResult<ScrapedData> => ({
  status: "rejected",
  reason: new Error(msg),
});

function cache(entry: Partial<Restaurant>): Map<string, Restaurant> {
  const r: Restaurant = {
    name: "Testaurang",
    address: "Mobilvägen 1",
    website: "https://x.test/",
    menu: [],
    ...entry,
  };
  return new Map([[r.name, r]]);
}

const sameWeek = new Date(now.getTime() - 2 * 3600_000).toISOString();
const lastWeek = new Date(now.getTime() - 8 * 86_400_000).toISOString();
const aMenu = [{ day: "Måndag", lines: ["Pasta"] }];

test("success stamps asOf and carries no error/stale", () => {
  const r = resolveRestaurant(desc, ok({ menu: aMenu }), null, now);
  assert.equal(r.asOf, now.toISOString());
  assert.equal(r.error, undefined);
  assert.equal(r.stale, undefined);
  assert.deepEqual(r.menu, aMenu);
});

test("failure with same-week cached menu falls back to it (stale, asOf preserved)", () => {
  const r = resolveRestaurant(
    desc,
    fail("503"),
    cache({ menu: aMenu, asOf: sameWeek }),
    now,
  );
  assert.equal(r.stale, true);
  assert.deepEqual(r.menu, aMenu);
  assert.equal(r.asOf, sameWeek); // original fetch time, NOT now
  assert.equal(r.error?.error, "503");
});

test("failure with last-week cached menu is NOT reused (error card)", () => {
  const r = resolveRestaurant(
    desc,
    fail("503"),
    cache({ menu: aMenu, asOf: lastWeek }),
    now,
  );
  assert.deepEqual(r.menu, []);
  assert.equal(r.stale, undefined);
  assert.equal(r.error?.error, "503");
});

test("failure with a cached error entry (empty menu) yields an error card", () => {
  const r = resolveRestaurant(
    desc,
    fail("415"),
    cache({ menu: [], asOf: sameWeek, error: { source: "x", error: "old" } }),
    now,
  );
  assert.deepEqual(r.menu, []);
  assert.equal(r.stale, undefined);
  assert.equal(r.error?.error, "415");
});

test("failure with no cache yields an error card (today's behaviour)", () => {
  const r = resolveRestaurant(desc, fail("boom"), null, now);
  assert.deepEqual(r.menu, []);
  assert.equal(r.stale, undefined);
  assert.equal(r.error?.error, "boom");
});
