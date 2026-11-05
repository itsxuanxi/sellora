import test from "node:test";
import assert from "node:assert/strict";
import { reconcileScore } from "@/lib/revenue/opportunity-score";
import { DIMENSION_MAX, DIMENSION_MIN } from "@/lib/revenue/config";

/**
 * Score caps and reconciliation.
 *
 * The bug these guard: the detail page re-summed the stored factor rows and
 * printed the raw sum against the dimension's cap, so Engagement showed
 * "29 / 25" — impossible by its own scale — and the five dimensions on screen
 * did not add up to the headline score, because the score was built from
 * capped values and the breakdown from uncapped ones.
 */

function factor(dimension: string, points: number, ruleKey = `r${points}`) {
  return { dimension, ruleKey, label: dimension, points, reason: `${points} points` };
}

test("a dimension never reports more than its documented maximum", () => {
  // The literal reproduction: engagement rules firing for 29 against a cap of 25.
  const r = reconcileScore([
    factor("engagement", 12, "opened"),
    factor("engagement", 10, "replied"),
    factor("engagement", 7, "meeting"),
  ]);
  const engagement = r.dimensions.find((d) => d.dimension === "engagement")!;

  assert.equal(engagement.raw, 29, "the rules really did fire for 29");
  assert.equal(engagement.contributed, DIMENSION_MAX.engagement);
  assert.equal(engagement.cappedBy, 4);
  assert.ok(
    engagement.contributed <= engagement.max,
    `contributed ${engagement.contributed} must not exceed max ${engagement.max}`
  );
});

test("every dimension stays inside its documented range for any input", () => {
  const extremes = [-999, -13, -1, 0, 1, 99, 999];
  for (const dim of Object.keys(DIMENSION_MAX)) {
    for (const points of extremes) {
      const d = reconcileScore([factor(dim, points)]).dimensions.find(
        (x) => x.dimension === dim
      )!;
      assert.ok(
        d.contributed >= DIMENSION_MIN[dim as keyof typeof DIMENSION_MIN] &&
          d.contributed <= DIMENSION_MAX[dim as keyof typeof DIMENSION_MAX],
        `${dim} contributed ${d.contributed} for raw ${points}, outside [${DIMENSION_MIN[dim as keyof typeof DIMENSION_MIN]}, ${DIMENSION_MAX[dim as keyof typeof DIMENSION_MAX]}]`
      );
    }
  }
});

test("the total equals the sum of the contributions shown", () => {
  const r = reconcileScore([
    factor("fit", 20),
    factor("engagement", 12),
    factor("engagement", 10),
    factor("engagement", 7),
    factor("buying_signals", 30),
    factor("relationship_health", 2),
    factor("deal_economics", 10),
  ]);

  const shown = r.dimensions.reduce((s, d) => s + d.contributed, 0);
  assert.equal(shown, r.total, "the breakdown on screen must add to the headline");
  assert.equal(r.total, 20 + 25 + 30 + 2 + 10);
  assert.ok(r.reconciles);
});

test("the negative floor is applied and reported, not hidden", () => {
  const r = reconcileScore([factor("relationship_health", -40)]);
  const d = r.dimensions.find((x) => x.dimension === "relationship_health")!;
  assert.equal(d.raw, -40);
  assert.equal(d.contributed, DIMENSION_MIN.relationship_health);
  assert.equal(d.flooredBy, DIMENSION_MIN.relationship_health + 40);
  assert.ok(d.flooredBy > 0, "the discarded penalty must be reportable");
});

test("a net-negative score is held at zero and says so", () => {
  const r = reconcileScore([factor("relationship_health", -12)]);
  assert.equal(r.subtotal, -12);
  assert.equal(r.total, 0);
  assert.equal(r.clampedBy, 12, "the gap must be reportable, not silent");
  assert.equal(r.reconciles, false);
});

test("missing data shows as no evidence, not as a zero the deal earned", () => {
  const r = reconcileScore([factor("fit", 8)]);
  const assessed = r.dimensions.filter((d) => !d.noEvidence).map((d) => d.dimension);
  const unassessed = r.dimensions.filter((d) => d.noEvidence).map((d) => d.dimension);

  assert.deepEqual(assessed, ["fit"]);
  assert.deepEqual(unassessed.sort(), [
    "buying_signals",
    "deal_economics",
    "engagement",
    "relationship_health",
  ]);
  // Every dimension is still present, so the breakdown can add up.
  assert.equal(r.dimensions.length, Object.keys(DIMENSION_MAX).length);
  assert.equal(r.total, 8);
});

test("no factors at all reconciles to zero rather than throwing", () => {
  const r = reconcileScore([]);
  assert.equal(r.total, 0);
  assert.ok(r.dimensions.every((d) => d.noEvidence));
  assert.ok(r.reconciles);
});

test("a factor from a retired dimension still counts toward the total", () => {
  // Snapshots are immutable and outlive config changes. Dropping the row
  // would make the breakdown stop adding up to the stored score.
  const r = reconcileScore([factor("fit", 10), factor("momentum_legacy", 5)]);
  assert.equal(r.unknown.length, 1);
  assert.equal(r.unknown[0].dimension, "momentum_legacy");
  assert.equal(r.total, 15);
});

test("duplicate factor rows are not silently merged", () => {
  // Two identical rules firing is a data problem worth seeing, not something
  // reconciliation should paper over — but it must still stay inside the cap.
  const r = reconcileScore([
    factor("buying_signals", 20, "pricing_visit"),
    factor("buying_signals", 20, "pricing_visit"),
  ]);
  const d = r.dimensions.find((x) => x.dimension === "buying_signals")!;
  assert.equal(d.factors.length, 2);
  assert.equal(d.raw, 40);
  assert.equal(d.contributed, DIMENSION_MAX.buying_signals);
  assert.ok(r.total <= 100);
});
