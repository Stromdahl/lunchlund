import test from "node:test";
import { parseKantin } from "./kantin";
import { matchSnapshot, readFixture } from "./__fixtures__/snapshot";

test("parseKantin matches snapshot", () => {
  const html = readFixture("kantin.html");
  matchSnapshot("kantin", parseKantin(html));
});
