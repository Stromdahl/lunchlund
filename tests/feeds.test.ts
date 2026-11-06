import test from "node:test";
import assert from "node:assert/strict";
import { renderRss } from "../src/feeds";
import { render } from "../src/render";

const result = {
  fetchedAt: new Date("2026-06-09T08:00:00Z"),
  restaurants: [
    {
      name: "Place",
      address: "Mobilvägen 1",
      website: "https://example.com/",
      menu: [{ day: "Hela veckan", lines: ["Sallad"] }],
    },
  ],
};

test("feeds and page link to the lunchlund.stromdahl.io Site", () => {
  const rss = renderRss(result);
  assert.match(rss, /<link>https:\/\/lunchlund\.stromdahl\.io\/<\/link>/);
  assert.match(rss, /atom:link href="https:\/\/lunchlund\.stromdahl\.io\/lunchlund\.xml"/);
  const html = render(result);
  assert.match(html, /href="https:\/\/lunchlund\.stromdahl\.io\/lunchlund\.json"/);
  assert.match(html, /href="https:\/\/lunchlund\.stromdahl\.io\/lunchlund\.xml"/);
  assert.doesNotMatch(rss + html, /github\.io/);
});
