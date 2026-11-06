import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { loadCache } from "../src/scrape";

const fx = (name: string) => join(__dirname, "fixtures", name);

test("loadCache returns a name-keyed map for a valid file", async () => {
  const map = await loadCache(fx("cache-valid.json"));
  assert.ok(map);
  assert.deepEqual([...map.keys()], ["Testaurang"]);
  assert.equal(map.get("Testaurang")?.menu[0].lines[0], "Pasta");
});

test("loadCache returns null for a missing file", async () => {
  assert.equal(await loadCache(fx("does-not-exist.json")), null);
});

test("loadCache returns null for an empty file", async () => {
  assert.equal(await loadCache(fx("cache-empty.json")), null);
});

test("loadCache returns null for a malformed file", async () => {
  assert.equal(await loadCache(fx("cache-malformed.json")), null);
});
