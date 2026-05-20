import test from "node:test";
import assert from "node:assert/strict";
import { weekdayLunch, formatInterval } from "../src/hours";

test("weekdayLunch produces mon-fri intervals, weekends empty", () => {
  const h = weekdayLunch("11:00", "14:00");
  assert.deepEqual(h.mon, [{ open: "11:00", close: "14:00" }]);
  assert.deepEqual(h.fri, [{ open: "11:00", close: "14:00" }]);
  assert.deepEqual(h.sat, []);
  assert.deepEqual(h.sun, []);
});

test("formatInterval", () => {
  assert.equal(formatInterval({ open: "11:00", close: "14:00" }), "11:00–14:00");
});
