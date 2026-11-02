import { test } from "node:test";
import assert from "node:assert/strict";
import { NAV_DESTINATIONS, RETIRED_NAV_HREFS } from "@/lib/nav";

/**
 * The navigation is a claim about what belongs in the daily loop, so the
 * things worth asserting are its size and its honesty — not its styling.
 */

test("the navigation stays small, and names what it contains", () => {
  // The number is a budget, not a target. Overlooked earned the seventh slot
  // because recovery is a separate job done at a separate time — a weekly
  // trawl through dormant deals, not part of working today's list — and it
  // was unreachable as a filter on a page about live proposals.
  assert.ok(
    NAV_DESTINATIONS.length <= 7,
    `${NAV_DESTINATIONS.length} destinations — the daily loop does not have that many parts`
  );
  assert.deepEqual(
    NAV_DESTINATIONS.map((i) => i.name),
    ["Today", "Deals", "Overlooked", "Actions", "Impact", "Integrations", "Settings"]
  );
});

test("every destination goes somewhere real", () => {
  for (const item of NAV_DESTINATIONS) {
    // "#" was how the old Meetings item advertised a page that did not exist.
    assert.notEqual(item.href, "#", `${item.name} points nowhere`);
    assert.match(item.href, /^\/[a-z-]+$/, `${item.name} has an odd href`);
  }
});

test("no destination is a placeholder for unfinished work", () => {
  // The nav type no longer has a `planned` flag; this fails if one returns.
  for (const item of NAV_DESTINATIONS) {
    assert.equal(
      "planned" in item,
      false,
      `${item.name} is marked planned — unfinished work should not hold a nav slot`
    );
  }
});

test("the retired sections are not in the navigation", () => {
  const hrefs = new Set(NAV_DESTINATIONS.map((i) => i.href));
  // Each of these is now a filter, a section of another page, or a redirect.
  for (const gone of RETIRED_NAV_HREFS) {
    assert.equal(hrefs.has(gone), false, `${gone} should not be a nav destination`);
  }
});
