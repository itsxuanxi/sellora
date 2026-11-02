import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MIN_SAMPLE,
  objectionInsight,
  outcomeSummary,
  recurringObjections,
} from "@/lib/deal-facts/memory";

test("an objection is counted once per deal, not once per mention", () => {
  // A client repeating themselves in one thread is one deal, not a trend.
  const tallies = recurringObjections([
    { opportunityId: "a", value: "Too expensive" },
    { opportunityId: "a", value: "too expensive" },
    { opportunityId: "a", value: "Too expensive." },
    { opportunityId: "b", value: "Too expensive" },
  ]);
  assert.deepEqual(tallies, [{ value: "Too expensive", deals: 2 }]);
});

test("a one-off is not called recurring", () => {
  assert.deepEqual(recurringObjections([{ opportunityId: "a", value: "Timing" }]), []);
});

test("below the sample threshold nothing is claimed", () => {
  const insight = objectionInsight([{ value: "Too expensive", deals: 2 }], 3);
  assert.equal(insight.insufficient, true);
  assert.match(insight.body, /not enough yet/i);
  // The sample size is stated even when it is the reason for saying nothing.
  assert.equal(insight.sampleSize, 3);
});

test("above the threshold the figure carries its denominator", () => {
  const insight = objectionInsight([{ value: "Too expensive", deals: 5 }], MIN_SAMPLE + 2);
  assert.equal(insight.insufficient, false);
  assert.match(insight.body, /5 of 10 deals/);
});

test("an objection pattern is never stated as a cause", () => {
  const insight = objectionInsight([{ value: "Too expensive", deals: 6 }], 12);
  assert.match(insight.body, /a count, not a diagnosis/);
  assert.ok(!/because|causes|leads to|results in/i.test(insight.body), insight.body);
});

test("a thin outcome history says so instead of reporting a rate", () => {
  const insight = outcomeSummary({ closed: 3, won: 2, lost: 1, lossReasons: {} });
  assert.equal(insight.insufficient, true);
  assert.match(insight.body, /too few to read anything into/i);
  assert.ok(!/%/.test(insight.body));
});

test("a sufficient history reports counts, not a win rate or a trend", () => {
  const insight = outcomeSummary({
    closed: 20,
    won: 8,
    lost: 12,
    lossReasons: { no_budget: 7, timing: 5 },
  });
  assert.equal(insight.insufficient, false);
  assert.match(insight.body, /20 closed deals, 8 were won and 12 lost/);
  assert.match(insight.body, /no budget \(7 of 12\)/);
  // No rate, no direction, no projection.
  assert.ok(!/%|improving|trend|forecast|predict/i.test(insight.body), insight.body);
});
