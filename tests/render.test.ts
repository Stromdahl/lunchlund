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
