import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSignalsCsv } from "@/lib/intent/providers/csv-provider";

const HEADER = "company,domain,industry,region,company_size,signal_type,title,description,evidence,source_url,occurred_at,confidence";

test("parses a well-formed row into a DetectedSignal", () => {
  const csv = `${HEADER}\nAcme Staffing,acme.com,Staffing,"Toronto, ON",51-200,job_surge,7 new roles,desc,ev,https://x.com,2026-08-15,high`;
  const { detected, errors } = parseSignalsCsv(csv);
  assert.equal(errors.length, 0);
  assert.equal(detected.length, 1);
  assert.equal(detected[0].companyName, "Acme Staffing");
  assert.equal(detected[0].region, "Toronto, ON");
  assert.equal(detected[0].signal.signalType, "job_surge");
  assert.equal(detected[0].signal.confidence, "high");
});

test("rejects a file missing required columns", () => {
  const { detected, errors } = parseSignalsCsv("company,title\nAcme,hi");
  assert.equal(detected.length, 0);
  assert.ok(errors[0].message.includes("Missing required column"));
});

test("skips a row with an unknown signal_type but keeps parsing others", () => {
  const csv = `${HEADER}\nAcme,,,,,not_a_real_signal,t,,,,2026-08-15,\nBeta,,,,,funding_round,t2,,,,2026-08-15,`;
  const { detected, errors } = parseSignalsCsv(csv);
  assert.equal(detected.length, 1);
  assert.equal(detected[0].companyName, "Beta");
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /Unknown signal_type/);
});

test("rejects a row with an unparseable occurred_at date", () => {
  const csv = `${HEADER}\nAcme,,,,,job_surge,t,,,,not-a-date,`;
  const { detected, errors } = parseSignalsCsv(csv);
  assert.equal(detected.length, 0);
  assert.match(errors[0].message, /Unparseable occurred_at/);
});

test("defaults confidence to medium when omitted", () => {
  const csv = `${HEADER}\nAcme,,,,,job_surge,t,,,,2026-08-15,`;
  const { detected } = parseSignalsCsv(csv);
  assert.equal(detected[0].signal.confidence, "medium");
});
