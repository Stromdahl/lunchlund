import test from "node:test";
import { parseLaziza } from "../../src/scrapers/laziza";
import { matchSnapshot, readFixture } from "../fixtures/snapshot";

test("parseLaziza matches snapshot", () => {
  const html = readFixture("laziza.html");
  matchSnapshot("laziza", parseLaziza(html));
});
