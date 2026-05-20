import test from "node:test";
import { parseLaziza } from "./laziza";
import { matchSnapshot, readFixture } from "./__fixtures__/snapshot";

test("parseLaziza matches snapshot", () => {
  const html = readFixture("laziza.html");
  matchSnapshot("laziza", parseLaziza(html));
});
