import test from "node:test";
import assert from "node:assert/strict";
import { render } from "../src/render";

test("render outputs an error card when a restaurant has an error", () => {
  const out = render({
    fetchedAt: new Date("2026-05-20T08:00:00Z"),
    restaurants: [
      {
        name: "Test",
        address: "Mobilvägen 1",
        website: "https://example.com/",
        menu: [],
        error: { source: "test", error: "boom" },
      },
    ],
  });
  assert.match(out, /class="card is-error"/);
  assert.match(out, /Kunde inte hämta menyn/);
  assert.match(out, /boom/);
});

test("render shows a stale card with menu + note, not an error card", () => {
  const out = render({
    fetchedAt: new Date("2026-06-08T08:00:00Z"),
    restaurants: [
      {
        name: "Stale Place",
        address: "Mobilvägen 2",
        website: "https://stale.test/",
        menu: [{ day: "Hela veckan", lines: ["Pasta carbonara"] }],
        asOf: "2026-06-08T05:00:00Z",
        stale: true,
        error: { source: "stale", error: "503 Service Unavailable" },
      },
    ],
  });
  assert.doesNotMatch(out, /class="card is-error"/);
  assert.match(out, /class="stale-note"/);
  assert.match(out, /Kunde inte uppdatera idag/);
  assert.match(out, /Pasta carbonara/);
});
