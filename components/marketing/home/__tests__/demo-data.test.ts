import { test } from "node:test";
import assert from "node:assert/strict";
import {
  INTEGRATION_CATALOG,
  TRUST_POINTS,
  HERO_SCENARIOS,
  HERO_STAGE_DURATION_MS,
  HERO_STAGE_TAIL_MS,
  scenarioDelays,
  scenarioStatus,
  stepDelays,
} from "@/components/marketing/home/demo-data";
import { sequenceDuration } from "@/components/marketing/home/use-demo-sequence";
import {
  DEMO_EVIDENCE,
  DEMO_PIPELINE,
} from "@/components/marketing/home/product-demo-data";

// The demo is marketing copy that makes arithmetic claims on screen. These
// guard the claims, not the styling.

test("no hero panel turns an outcome into revenue", () => {
  // A stage move is not money, and Selryn cannot measure how much of an
  // outcome it caused. The separate outcome panel is gone — the hero is
  // three capsules now, Who / Why / Next — and its one irreplaceable
  // sentence moved into the last capsule's closing, so the guard moved with
  // it rather than being deleted along with the panel.
  const outcome = HERO_SCENARIOS.find((s) => s.id === "next")!;

  for (const step of outcome.steps) {
    const payload = JSON.stringify(step.payload);
    assert.ok(
      !payload.includes('"prefix":"$"'),
      `the outcome panel still prints money: ${payload}`
    );
  }

  // And it says in words that nothing was won.
  const prose = [
    outcome.closing,
    ...outcome.steps.map((x) => `${x.status} ${JSON.stringify(x.payload)}`),
    ...outcome.rail.fields.map((f) => `${f.key} ${f.value}`),
  ]
    .join(" ")
    .toLowerCase();
  assert.ok(/not won|still open/.test(prose), "the outcome panel never says the deal is still open");
});

test("every hero step has a readable beat", () => {
  for (const scenario of HERO_SCENARIOS) {
    for (const step of scenario.steps) {
      assert.ok(
        step.delay >= 500 && step.delay <= 1200,
        `${scenario.id}/${step.id} delay ${step.delay}ms is outside the 500–1200ms band`
      );
    }
  }
});

test("every hero scenario finishes inside the shared dwell", () => {
  // All four tabs hold for the same period, so the progress line means the
  // same thing on each. That only stays honest if no scenario's steps overrun
  // it: otherwise a tab advances mid-sentence and the reader never sees the
  // result. This is the assertion a fixed dwell would otherwise let slip.
  for (const scenario of HERO_SCENARIOS) {
    const stepTime = scenarioDelays(scenario).reduce((a, b) => a + b, 0);
    assert.ok(
      stepTime + HERO_STAGE_TAIL_MS <= HERO_STAGE_DURATION_MS,
      `${scenario.id} needs ${stepTime}ms of steps, leaving under ${HERO_STAGE_TAIL_MS}ms to read the result inside the ${HERO_STAGE_DURATION_MS}ms dwell`
    );
  }
});

test("the shared dwell is long enough to read but short enough to cycle", () => {
  assert.ok(HERO_STAGE_DURATION_MS >= 5000 && HERO_STAGE_DURATION_MS <= 10_000);
});

test("the interactive demo's deals carry a reason and records to back it", () => {
  // Screen 2's scripted scenarios are gone; this is what replaced them, and
  // a card with no evidence behind it would be the thing the product spends
  // every screen arguing against.
  for (const deal of DEMO_PIPELINE) {
    assert.ok(deal.because.length > 0, `${deal.accountName} states no reason`);
    const records = DEMO_EVIDENCE[deal.opportunityId] ?? [];
    assert.ok(records.length >= 2, `${deal.accountName} has ${records.length} records`);
    assert.ok(
      records.some((r) => r.basis === "observed"),
      `${deal.accountName} rests entirely on inference`
    );
  }
});

test("the demo's draft is addressed to the deal it belongs to", () => {
  // A draft that named the wrong company would be the single most damaging
  // detail a visitor could notice on this page.
  for (const deal of DEMO_PIPELINE) {
    assert.ok(deal.draft.subject.length > 0);
    assert.ok(deal.draft.body.includes(deal.contactName.split(" ")[0]));
  }
});

test("signal detection shows four distinct signals, not one", () => {
  // A monitor with a single row reads as an illustration. The panel's job is
  // to look like a product with real evidence in it.
  const detection = HERO_SCENARIOS.find((s) => s.id === "why")!;
  const signals = detection.steps.filter((s) => s.action === "signal");
  assert.ok(signals.length >= 4, `only ${signals.length} signals on the detection panel`);

  const labels = new Set(signals.map((s) => (s.action === "signal" ? s.payload.label : "")));
  assert.equal(labels.size, signals.length, "duplicate signal labels");
});

test("the recommendation panel keeps a human in the loop", () => {
  const action = HERO_SCENARIOS.find((s) => s.id === "next")!;
  const approvals = action.steps.filter((s) => s.action === "approve");
  assert.ok(approvals.length >= 2, "no awaiting-then-approved beat");

  const states = approvals.map((s) => (s.action === "approve" ? s.payload.state : ""));
  assert.deepEqual(states, ["awaiting", "approved"]);
});

test("hero scenarios cover the full loop across the set", () => {
  const kinds = new Set(HERO_SCENARIOS.flatMap((s) => s.steps.map((x) => x.action)));
  // "rank" is no longer among them. The hero's ranking panel was a scripted
  // version of what the interactive demo below now does with the product's
  // own `rankFollowUps`, so the page was demonstrating its prioritisation
  // twice — once for real and once as an animation. The script went.
  // Three capsules now, so the set covers Who / Why / Next rather than the
  // whole loop end to end. "execute", "response" and "outcome" belonged to
  // the separate outcome panel; what replaced that promise is the closing
  // line asserted above, not another animation of it.
  for (const required of ["signal", "analyze", "score", "recommend", "approve"]) {
    assert.ok(kinds.has(required as never), `no step anywhere demonstrates "${required}"`);
  }
});

test("every rail row resolves on a step the scenario actually has", () => {
  // `after` is an index into the step list. One off the end and the row never
  // resolves, which shows up as a permanently dashed placeholder in the panel
  // rather than as an error anywhere.
  for (const scenario of HERO_SCENARIOS) {
    for (const field of scenario.rail.fields) {
      assert.ok(
        field.after >= 0 && field.after <= scenario.steps.length,
        `${scenario.id}/${field.key} resolves after step ${field.after} of ${scenario.steps.length}`
      );
    }
    assert.ok(
      scenario.rail.meter.after <= scenario.steps.length,
      `${scenario.id} meter never fills`
    );
    assert.ok(
      scenario.rail.meter.value >= 0 && scenario.rail.meter.value <= 100,
      `${scenario.id} meter is not a percentage`
    );
  }
});

test("a rail opens with something already in it", () => {
  // A rail whose every row starts blank reads as a loading skeleton, which is
  // the opposite of the impression the record column exists to give.
  for (const scenario of HERO_SCENARIOS) {
    const atRest = scenario.rail.fields.filter((f) => f.after === 0);
    assert.ok(
      atRest.length >= 1,
      `${scenario.id}'s rail is entirely empty before the first step lands`
    );
  }
});

test("rail rows are distinct machine field names", () => {
  for (const scenario of HERO_SCENARIOS) {
    const keys = scenario.rail.fields.map((f) => f.key);
    assert.equal(new Set(keys).size, keys.length, `${scenario.id} repeats a rail key`);
    for (const key of keys) {
      assert.match(
        key,
        /^[a-z][a-z0-9_]*$/,
        `${scenario.id}/${key} is not a field name the product would store`
      );
    }
  }
});

test("the rail never restates the header it sits beside", () => {
  // Account, owner, stage and deal value are already on screen a centimetre
  // away. Repeating them is how a record rail turns into a caption.
  for (const scenario of HERO_SCENARIOS) {
    const header = [
      scenario.subject.company,
      scenario.subject.owner,
      scenario.subject.stage,
    ]
      .filter(Boolean)
      .map((v) => String(v).toLowerCase());

    for (const field of scenario.rail.fields) {
      assert.ok(
        !header.includes(field.value.toLowerCase()),
        `${scenario.id}/${field.key} repeats the header value "${field.value}"`
      );
    }
  }
});

test("no hero meter is a forecast dressed as a measurement", () => {
  // Every meter on this page has to count something a reader can check
  // against the rail printed beside it. A win probability could not be
  // checked against anything, which is why none of them is one any more.
  for (const scenario of HERO_SCENARIOS) {
    assert.ok(
      !/probability|expected revenue|protected|intent score/i.test(
        `${scenario.rail.meter.label} ${scenario.rail.meter.note}`
      ),
      `${scenario.id}'s meter is forecasting: ${scenario.rail.meter.label}`
    );
  }
  const outcome = HERO_SCENARIOS.find((s) => s.id === "next")!;
  assert.ok(
    !/probability|expected revenue|protected/i.test(
      `${outcome.rail.meter.label} ${outcome.rail.meter.note}`
    ),
    "the outcome meter is back to forecasting"
  );
});

test("nothing claims Selryn reads what is inside an email", () => {
  // The positioning says Selryn works from real email history, and it does —
  // subject, direction and timestamp, which is what a CRM exposes. It never
  // sees a message body: HubSpot's engagement sync requests
  // hs_email_subject, hs_email_direction and hs_timestamp and nothing else,
  // and no inbox connector exists. So "reads your email" has a boundary, and
  // the boundary is the difference between finding a deal that went quiet
  // (which it does) and finding a question inside a message (which it
  // cannot). Marketing copy drifts toward the second claim because it sounds
  // better.
  const everything = [
    ...HERO_SCENARIOS.flatMap((s) => [
      s.panelLabel,
      s.closing,
      ...s.steps.map((x) => `${x.status} ${JSON.stringify(x.payload)}`),
    ]),
    ...DEMO_PIPELINE.flatMap((d) => [
      d.headline,
      d.because,
      d.action,
      d.draft.subject,
      d.draft.body,
    ]),
  ]
    .join(" ")
    .toLowerCase();

  for (const banned of [
    "reads your emails",
    "reads their emails",
    "email content",
    "message body",
    "understands the conversation",
    "reads the conversation",
  ]) {
    assert.ok(!everything.includes(banned), `demo copy claims to read email content: "${banned}"`);
  }
});

test("the integration catalog names each connector once", () => {
  const keys = INTEGRATION_CATALOG.map((i) => i.key);
  assert.equal(new Set(keys).size, keys.length, "a connector appears twice");

  const names = INTEGRATION_CATALOG.map((i) => i.name);
  assert.equal(new Set(names).size, names.length, "two rows share a name");
});

test("the catalog records whether code exists, not whether it is switched on", () => {
  // `built` must stay a fact about the repository. The moment someone edits it
  // to mean "configured in production" the page starts lying in whichever
  // direction that deployment happens to differ, which is the drift the
  // server-side resolver exists to prevent.
  const built = new Set(
    INTEGRATION_CATALOG.filter((i) => i.built).map((i) => i.key)
  );
  for (const shipped of [
    "csv",
    "google_signin",
    "outbound_email",
    "hubspot",
    "slack",
    // OAuth, sync, parse and send all exist under lib/integrations/gmail.
    "gmail",
  ]) {
    assert.ok(built.has(shipped as never), `${shipped} has a connector and is not marked built`);
  }
  for (const absent of ["salesforce", "pipedrive", "calendar"]) {
    assert.ok(!built.has(absent as never), `${absent} is marked built with no connector`);
  }
});

test("no marketing copy claims single sign-on", () => {
  // It was listed for months as a planned trust point. There is no SAML or SSO
  // code anywhere in the repository, and the tier it propped up is gone.
  const copy = [
    ...TRUST_POINTS.map((t) => t.text),
    ...INTEGRATION_CATALOG.map((i) => i.name),
  ]
    .join(" ")
    .toLowerCase();

  for (const banned of ["sso", "saml", "single sign-on"]) {
    assert.ok(!copy.includes(banned), `marketing copy still claims "${banned}"`);
  }
});

test("a trust point is stated once, with a status", () => {
  const texts = TRUST_POINTS.map((t) => t.text);
  assert.equal(new Set(texts).size, texts.length, "a trust point is repeated");
  for (const point of TRUST_POINTS) {
    assert.ok(
      point.status === "available" || point.status === "planned",
      `${point.text} has no honest status`
    );
  }
});

test("nothing claims a recommendation caused a win", () => {
  const prose = [
    ...HERO_SCENARIOS.flatMap((s) => [s.closing, ...s.steps.map((x) => JSON.stringify(x.payload))]),
    ...DEMO_PIPELINE.map((d) => `${d.headline} ${d.because}`),
  ].join(" ").toLowerCase();

  for (const banned of ["caused", "guaranteed", "proven to", "increases revenue by"]) {
    assert.ok(!prose.includes(banned), `demo copy makes a causal claim: "${banned}"`);
  }
});

test("no marketing surface resurrects the vocabulary the product dropped", () => {
  // These phrases all shipped on the homepage while the application had
  // already stopped making the claims behind them: ranking by expected
  // revenue, a two-figure win probability, and revenue "protected" by a
  // reply. Marketing copy drifts back toward whatever sounds most impressive,
  // so the guard lives in the test suite rather than in a review habit.
  const everything = [
    ...HERO_SCENARIOS.flatMap((s) => [
      s.panelLabel,
      s.tabLabel,
      s.closing,
      s.rail.label,
      s.rail.meter.label,
      s.rail.meter.note,
      ...s.rail.fields.map((f) => `${f.key} ${f.value}`),
      ...s.steps.map((x) => `${x.status} ${JSON.stringify(x.payload)}`),
    ]),
    ...DEMO_PIPELINE.flatMap((d) => [
      d.headline,
      d.because,
      d.action,
      d.draft.subject,
      d.draft.body,
      d.staleness ?? "",
    ]),
    ...Object.values(DEMO_EVIDENCE).flat().map((r) => `${r.label} ${r.source}`),
    // The status line above each panel is computed, not stored, which is how
    // "Ranked by expected revenue" survived the first pass of this guard.
    ...HERO_SCENARIOS.map((s) => scenarioStatus(s).label),
  ]
    .join(" ")
    .toLowerCase();

  for (const banned of [
    // No 0-100 score anywhere on this page. The deal screens stopped
    // presenting one because it is a stage baseline times hand-tuned
    // weights with no calibration behind it, and a visitor who has never
    // seen the product has even less basis to judge one.
    "intent score",
    "lead score",
    "priority score",
    "win probability",
    "protected revenue",
    "revenue protected",
    "revenue recovered",
    "revenue at risk",
    "revenue leak",
    "next best action",
    "probability of closing",
    "expected value first",
  ]) {
    assert.ok(!everything.includes(banned), `marketing copy says "${banned}" again`);
  }
});
