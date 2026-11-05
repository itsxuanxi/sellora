import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALL_NAV_DESTINATIONS,
  NAV_DESTINATIONS,
  NAV_SUPPORTING,
  REDIRECTED_NAV_HREFS,
  RETIRED_NAV_HREFS,
} from "@/lib/nav";

/**
 * The navigation is a claim about what the product is for, so the things
 * worth asserting are its shape and its honesty — not its styling.
 */

test("the primary navigation is the three capabilities, and only those", () => {
  assert.deepEqual(
    NAV_DESTINATIONS.map((i) => i.name),
    ["Today", "Deals", "Outcomes"]
  );
});

test("infrastructure is separated from the capabilities", () => {
  // Integrations and Settings matter enormously and are not features. Listing
  // them alongside the three made the rail read as five equal things.
  assert.deepEqual(
    NAV_SUPPORTING.map((i) => i.name),
    ["Integrations", "Settings"]
  );
  const primary = new Set(NAV_DESTINATIONS.map((i) => i.href));
  for (const s of NAV_SUPPORTING) {
    assert.equal(primary.has(s.href), false, `${s.name} is in both groups`);
  }
});

test("Today is the entry point", () => {
  assert.equal(NAV_DESTINATIONS[0].name, "Today");
  assert.equal(NAV_DESTINATIONS[0].href, "/dashboard");
});

test("every destination goes somewhere real and says what it answers", () => {
  for (const item of ALL_NAV_DESTINATIONS) {
    // "#" was how the old Meetings item advertised a page that did not exist.
    assert.notEqual(item.href, "#", `${item.name} points nowhere`);
    assert.match(item.href, /^\/[a-z-]+$/, `${item.name} has an odd href`);
    assert.ok(
      item.answers.length > 10 && item.answers.includes("?"),
      `${item.name} does not state the question it answers`
    );
  }
});

test("no destination is a placeholder for unfinished work", () => {
  for (const item of ALL_NAV_DESTINATIONS) {
    assert.equal(
      "planned" in item,
      false,
      `${item.name} is marked planned — unfinished work should not hold a nav slot`
    );
  }
});

test("nothing in the navigation duplicates another entry", () => {
  const hrefs = ALL_NAV_DESTINATIONS.map((i) => i.href);
  assert.equal(new Set(hrefs).size, hrefs.length, "two entries share an href");
});

test("retired and redirected routes are not navigation destinations", () => {
  const hrefs = new Set(ALL_NAV_DESTINATIONS.map((i) => i.href));
  for (const gone of [...RETIRED_NAV_HREFS, ...Object.keys(REDIRECTED_NAV_HREFS)]) {
    assert.equal(hrefs.has(gone), false, `${gone} should not be a nav destination`);
  }
});

test("every redirect lands on a live destination", () => {
  // A redirect to a route that no longer exists is worse than a 404: it looks
  // like it worked.
  const live = new Set(ALL_NAV_DESTINATIONS.map((i) => i.href));
  for (const [from, to] of Object.entries(REDIRECTED_NAV_HREFS)) {
    const path = to.split("?")[0];
    assert.ok(live.has(path), `${from} forwards to ${to}, which is not a destination`);
  }
});

test("the routes that lost a nav slot still have somewhere to be", () => {
  // Each of these was a nav entry once. None may silently vanish: either it
  // forwards, or it is reachable from inside the screen it belongs to.
  for (const former of ["/actions", "/impact", "/recovery"]) {
    const forwarded = former in REDIRECTED_NAV_HREFS;
    const retired = RETIRED_NAV_HREFS.includes(former);
    assert.ok(forwarded || retired, `${former} was dropped without a home`);
  }
});
