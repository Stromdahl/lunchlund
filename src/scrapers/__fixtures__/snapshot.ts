import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const DIR = __dirname;

export function readFixture(name: string): string {
  return readFileSync(join(DIR, name), "utf8");
}

// Asserts `value` deep-equals the stored snapshot. On first run (no snapshot
// file present), writes the current value as the baseline — same convention
// as Jest's snapshot testing. To intentionally update a snapshot, delete the
// .snap.json file and rerun.
export function matchSnapshot(name: string, value: unknown): void {
  const path = join(DIR, `${name}.snap.json`);
  const json = JSON.stringify(value, null, 2);
  if (!existsSync(path)) {
    writeFileSync(path, json + "\n");
    console.error(`snapshot: created ${name}.snap.json`);
    return;
  }
  const expected = readFileSync(path, "utf8").trimEnd();
  assert.equal(json, expected);
}
