import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dealTemplateCsv,
  normalizeStage,
  parseAmount,
  parseDate,
  parseDealsCsv,
} from "@/lib/import/deals";

const HEADER = "external_id,company,contact_name,contact_email,stage,amount,currency,last_contacted_at,next_step_at";

// ── The happy path, and the template that teaches it ─────────────────────

test("a well-formed file imports every row", () => {
  const result = parseDealsCsv(
    [HEADER, "D1,Northwind,Priya Shah,priya@northwind.example,proposal,12500,GBP,2026-10-28,2026-11-10"].join("\n")
  );
  assert.deepEqual(result.errors, []);
  assert.equal(result.deals.length, 1);
  assert.deepEqual(
    { ...result.deals[0], lastContactedAt: null, nextStepAt: null },
    {
      row: 2,
      externalId: "D1",
      company: "Northwind",
      contactName: "Priya Shah",
      contactEmail: "priya@northwind.example",
      stage: "PROPOSAL",
      amount: 12_500,
      currency: "GBP",
      lastContactedAt: null,
      nextStepAt: null,
    }
  );
});

test("the template Selryn hands out parses cleanly", () => {
  // A template that fails its own importer is the worst possible first run.
  const result = parseDealsCsv(dealTemplateCsv());
  assert.deepEqual(result.errors, []);
  assert.equal(result.deals.length, 3);
  // Including the deliberately sparse row.
  assert.equal(result.deals[2].amount, null);
  assert.equal(result.deals[2].contactEmail, null);
});

// ── The file they actually have ──────────────────────────────────────────

test("columns are matched by alias, case and punctuation", () => {
  const result = parseDealsCsv(
    ["Deal ID,Account Name,Deal Stage,Deal Value", "D1,Northwind,Proposal Sent,12500"].join("\n")
  );
  assert.deepEqual(result.errors, []);
  assert.equal(result.deals[0].company, "Northwind");
  assert.equal(result.deals[0].stage, "PROPOSAL");
  assert.equal(result.deals[0].amount, 12_500);
});

test("a CRLF file with a BOM imports", () => {
  // What Excel produces, and otherwise a mystery failure on row 1.
  const result = parseDealsCsv(`﻿${HEADER}\r\nD1,Northwind,,,proposal,,,\r\n`);
  assert.deepEqual(result.errors, []);
  assert.equal(result.deals.length, 1);
});

test("quoted commas inside a company name survive", () => {
  const result = parseDealsCsv([HEADER, '"D1","Smith, Jones & Co",,,proposal,,,,'].join("\n"));
  assert.deepEqual(result.errors, []);
  assert.equal(result.deals[0].company, "Smith, Jones & Co");
});

test("unknown columns are reported but do not block the import", () => {
  const result = parseDealsCsv(
    ["external_id,company,stage,owner_notes", "D1,Northwind,proposal,call them back"].join("\n")
  );
  assert.deepEqual(result.errors, []);
  assert.ok(result.ignoredColumns.includes("owner_notes"));
});

test("agency stage vocabulary is accepted", () => {
  for (const [word, expected] of [
    ["Proposal Sent", "PROPOSAL"],
    ["pitched", "PROPOSAL"],
    ["Closed Won", "WON"],
    ["negotiating", "NEGOTIATION"],
    ["discovery", "QUALIFYING"],
  ] as const) {
    assert.equal(normalizeStage(word), expected, word);
  }
});

// ── Bad data is reported, never guessed ──────────────────────────────────

test("an unreadable amount fails the row instead of becoming zero", () => {
  // A deal silently worth 0 is worse than a refused row: nobody notices it.
  const result = parseDealsCsv([HEADER, "D1,Northwind,,,proposal,TBC,,,"].join("\n"));
  assert.equal(result.deals.length, 0);
  assert.equal(result.errors[0].row, 2);
  assert.equal(result.errors[0].column, "amount");
  assert.match(result.errors[0].message, /12500/);
});

test("an ambiguous date is refused rather than guessed", () => {
  // 03/04/2026 is March in one country and April in another; guessing puts a
  // follow-up a month wrong without telling anyone.
  const result = parseDealsCsv([HEADER, "D1,Northwind,,,proposal,,,03/04/2026,"].join("\n"));
  assert.equal(result.deals.length, 0);
  assert.match(result.errors[0].message, /YYYY-MM-DD/);
});

test("an unrecognised stage fails the row rather than defaulting", () => {
  // Filing a deal in the wrong stage changes what Selryn recommends about it.
  const result = parseDealsCsv([HEADER, "D1,Northwind,,,Snoozed,,,,"].join("\n"));
  assert.equal(result.deals.length, 0);
  assert.equal(result.errors[0].column, "stage");
});

test("every error names the line the user can see", () => {
  const result = parseDealsCsv(
    [HEADER, "D1,Northwind,,,proposal,,,,", "D2,,,,proposal,,,,", "D3,Acme,,,nope,,,,"].join("\n")
  );
  assert.equal(result.deals.length, 1);
  assert.deepEqual(result.errors.map((e) => e.row), [3, 4]);
});

test("a good row still imports when a neighbouring row fails", () => {
  const result = parseDealsCsv(
    [HEADER, "D1,Northwind,,,proposal,bad,,,", "D2,Acme,,,proposal,900,,,"].join("\n")
  );
  assert.equal(result.deals.length, 1);
  assert.equal(result.deals[0].externalId, "D2");
  assert.equal(result.errors.length, 1);
});

test("a missing required column stops the import with one clear message", () => {
  const result = parseDealsCsv(["company,stage", "Northwind,proposal"].join("\n"));
  assert.equal(result.deals.length, 0);
  assert.match(result.errors[0].message, /external_id/);
  assert.match(result.errors[0].message, /template/i);
});

test("an empty file is reported, not treated as zero deals", () => {
  assert.match(parseDealsCsv("").errors[0].message, /empty/i);
});

// ── Identity, so re-importing is safe ────────────────────────────────────

test("a row without an id is refused, because re-import would duplicate it", () => {
  const result = parseDealsCsv([HEADER, ",Northwind,,,proposal,,,,"].join("\n"));
  assert.equal(result.deals.length, 0);
  assert.match(result.errors[0].message, /re-import/i);
});

test("the same id twice in one file is reported with both line numbers", () => {
  // Otherwise the last row silently wins and it looks like a deal was lost.
  const result = parseDealsCsv(
    [HEADER, "D1,Northwind,,,proposal,,,,", "D1,Northwind Again,,,won,,,,"].join("\n")
  );
  assert.equal(result.deals.length, 1);
  assert.match(result.errors[0].message, /Duplicate id "D1".*row 2/);
});

// ── Value parsing ────────────────────────────────────────────────────────

test("amounts tolerate the symbols and separators a spreadsheet adds", () => {
  for (const [raw, expected] of [["£12,500", 12_500], ["12500.00", 12_500], ["12 500", 12_500], ["", null]] as const) {
    const parsed = parseAmount(raw);
    assert.ok(parsed.ok, raw);
    assert.equal(parsed.value, expected, raw);
  }
});

test("a negative amount is refused", () => {
  assert.equal(parseAmount("-500").ok, false);
});

test("ISO dates parse and blanks are allowed", () => {
  const iso = parseDate("2026-11-10");
  assert.ok(iso.ok && iso.value?.getUTCFullYear() === 2026);
  const blank = parseDate("");
  assert.ok(blank.ok && blank.value === null);
  assert.equal(parseDate("next tuesday").ok, false);
});
