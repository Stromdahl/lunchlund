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

// --- Page-level staleness banner -------------------------------------------
//
// The banner is injected by the inline script at view time (a build can't know
// it will later go stale), so these tests run that script against a minimal
// DOM stub with the clock pinned. Guards the signal that was missing when the
// scheduled workflow was disabled for inactivity on 2026-08-27 and the page
// served week-35 menus into September without saying so.

const RealDate = Date;

type StubEl = { className: string; innerHTML: string; setAttribute(): void };

/** Run the page's inline <script> with `now` as the clock, and return the
 *  `.page-stale` banner it appended to the header, if any. */
function runPageScript(html: string, now: string): StubEl | null {
  const script = html.match(/<script>([\s\S]*)<\/script>/)![1];
  const appended: StubEl[] = [];
  const header = { appendChild: (el: StubEl) => void appended.push(el) };
  const doc = {
    querySelectorAll: () => [] as unknown[],
    querySelector: (sel: string) => (sel === "header.top" ? header : null),
    createElement: (): StubEl => ({
      className: "",
      innerHTML: "",
      setAttribute() {},
    }),
  };
  // A `function` expression, not an arrow: the script calls `new Date(...)`,
  // and arrows aren't constructable. Returning an object from a constructor
  // overrides `this`, so `new FakeDate()` yields a real Date pinned to `now`.
  const FakeDate = Object.assign(
    function (...args: unknown[]) {
      return args.length ? Reflect.construct(RealDate, args) : new RealDate(now);
    },
    { UTC: RealDate.UTC, now: () => new RealDate(now).getTime() },
  );
  new Function("document", "Date", script)(doc, FakeDate);
  return appended.find((el) => el.className === "page-stale") ?? null;
}

const page = (fetchedAt: string) =>
  render({
    fetchedAt: new Date(fetchedAt),
    restaurants: [
      {
        name: "Test",
        address: "Mobilvägen 1",
        website: "https://example.com/",
        menu: [{ day: "Måndag", lines: ["Sallad"] }],
      },
    ],
  });

test("no stale banner on the day of the build", () => {
  const out = page("2026-09-01T06:00:00Z");
  assert.equal(runPageScript(out, "2026-09-01T15:00:00+02:00"), null);
});

test("no stale banner over the weekend after a Friday build", () => {
  const out = page("2026-08-28T06:00:00Z"); // Friday
  assert.equal(runPageScript(out, "2026-08-29T11:00:00+02:00"), null, "Saturday");
  assert.equal(runPageScript(out, "2026-08-30T11:00:00+02:00"), null, "Sunday");
  // Monday morning: still zero *intervening* weekdays, so we stay quiet rather
  // than fire before that morning's (drift-prone) build has had its chance.
  assert.equal(runPageScript(out, "2026-08-31T09:00:00+02:00"), null, "Monday");
});

test("stale banner counts the weekdays a build has been missed", () => {
  const out = page("2026-08-27T09:00:00Z"); // Thursday — the real outage
  const tue = runPageScript(out, "2026-09-01T09:00:00+02:00");
  assert.ok(tue, "Tuesday after a Thursday build warns");
  assert.match(tue!.innerHTML, /Sidan är inte uppdaterad/);
  assert.match(tue!.innerHTML, /torsdag 27 augusti/);
  assert.match(tue!.innerHTML, /2 vardagar/); // Friday + Monday

  const fri = runPageScript(out, "2026-08-31T09:00:00+02:00"); // Monday
  assert.match(fri!.innerHTML, /1 vardag sedan/, "singular for a single missed day");
});
