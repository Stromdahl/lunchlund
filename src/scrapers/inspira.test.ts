import test from "node:test";
import { parseElementorLunch } from "./elementor-lunch";
import { weekdayLunch } from "../hours";
import { matchSnapshot, readFixture } from "./__fixtures__/snapshot";

test("parseElementorLunch (inspira) matches snapshot", () => {
  const html = readFixture("inspira.html");
  const r = parseElementorLunch(html, {
    url: "https://restauranginspira.se/",
    name: "Restaurang & Café Inspira",
    address: "Scheelevägen 4, Lund",
    hours: weekdayLunch("11:30", "13:30"),
  });
  matchSnapshot("inspira", r);
});
