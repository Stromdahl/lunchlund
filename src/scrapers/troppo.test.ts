import test from "node:test";
import { parseTroppo } from "./troppo";
import { matchSnapshot, readFixture } from "./__fixtures__/snapshot";

test("parseTroppo matches snapshot", () => {
  const html = readFixture("troppo.html");
  matchSnapshot("troppo", parseTroppo(html));
});
