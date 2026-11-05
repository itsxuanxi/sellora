import { test } from "node:test";
import assert from "node:assert/strict";
import {
  IMPORT_STALE_DAYS,
  IMPORT_VERY_STALE_DAYS,
  describeImportFreshness,
} from "@/lib/import/freshness";

const NOW = new Date("2026-11-05T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

test("a workspace with no import says so rather than showing a blank", () => {
  const f = describeImportFreshness(null, NOW);
  assert.equal(f.level, "none");
  assert.equal(f.days, null);
  assert.match(f.label, /No pipeline imported/i);
});

test("a recent import reads as fresh", () => {
  assert.equal(describeImportFreshness(daysAgo(0), NOW).level, "fresh");
  assert.equal(describeImportFreshness(daysAgo(2), NOW).level, "fresh");
  assert.match(describeImportFreshness(daysAgo(1), NOW).label, /1 day ago/);
});

test("past a week it asks to be refreshed", () => {
  const f = describeImportFreshness(daysAgo(IMPORT_STALE_DAYS), NOW);
  assert.equal(f.level, "stale");
  assert.match(f.label, /re-import/i);
});

test("a month old is reported as affecting the recommendations", () => {
  // Stale pipeline is the input that makes advice wrong invisibly, so the
  // warning names that consequence rather than just the age.
  const f = describeImportFreshness(daysAgo(IMPORT_VERY_STALE_DAYS + 5), NOW);
  assert.equal(f.level, "very_stale");
  assert.match(f.label, /Recommendations are based on it/i);
});

test("every level produces a sentence, never a bare date", () => {
  for (const d of [null, daysAgo(0), daysAgo(9), daysAgo(99)]) {
    const f = describeImportFreshness(d, NOW);
    // A complete sentence: at least two words and closing punctuation.
    assert.ok(/\s/.test(f.label.trim()), f.label);
    assert.ok(/[.!]$/.test(f.label), f.label);
  }
});

test("a clock skew into the future does not report negative days", () => {
  const f = describeImportFreshness(new Date(NOW.getTime() + 86_400_000), NOW);
  assert.equal(f.level, "fresh");
  assert.ok(!/-\d/.test(f.label), f.label);
});
