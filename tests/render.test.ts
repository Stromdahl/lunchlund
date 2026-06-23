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

test("render links the address to a map and shows the walk time", () => {
  const out = render({
    fetchedAt: new Date("2026-06-09T08:00:00Z"),
    restaurants: [
      {
        name: "Walk Place",
        address: "Mobilvägen 12, Lund",
        website: "https://walk.test/",
        walkMinutes: 4,
        menu: [{ day: "Hela veckan", lines: ["Sallad"] }],
      },
    ],
  });
  // address is an anchor to a Google Maps search for the url-encoded address
  assert.match(
    out,
    /<a class="addr" href="[^"]*google\.com\/maps\/search[^"]*Mobilv%C3%A4gen%2012[^"]*"[^>]*>Mobilvägen 12, Lund<\/a>/,
  );
  assert.match(out, /class="walk"[^>]*>.*?ca 4 min<\/span>/s);
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
        // Fetched on an earlier day → the banner is meaningful and shown.
        asOf: "2026-06-05T05:00:00Z",
        stale: true,
        error: { source: "stale", error: "503 Service Unavailable" },
      },
    ],
  });
  assert.doesNotMatch(out, /class="card is-error"/);
  assert.match(out, /class="stale-note"/);
  assert.match(out, /Kunde inte uppdatera idag/);
  assert.match(out, /visar menyn från fre 5 juni/);
  assert.match(out, /Pasta carbonara/);
});

test("render hides the stale banner when last-known-good is from earlier today", () => {
  const out = render({
    fetchedAt: new Date("2026-06-08T08:00:00Z"), // 10:00 Stockholm
    restaurants: [
      {
        name: "Same Day Place",
        address: "Mobilvägen 3",
        website: "https://sameday.test/",
        menu: [{ day: "Hela veckan", lines: ["Pasta carbonara"] }],
        asOf: "2026-06-08T05:00:00Z", // 07:00 Stockholm, same day
        stale: true,
        error: { source: "sameday", error: "503 Service Unavailable" },
      },
    ],
  });
  // Fallback data is from earlier today → no contradictory banner, but the
  // menu still renders (and it is not an error card).
  assert.doesNotMatch(out, /class="card is-error"/);
  assert.doesNotMatch(out, /class="stale-note"/);
  assert.doesNotMatch(out, /Kunde inte uppdatera/);
  assert.match(out, /Pasta carbonara/);
});
