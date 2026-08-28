import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isSimulated,
  isSimulatedId,
  simulatedId,
  SIMULATED_ID_PREFIX,
} from "@/lib/sandbox";
import { sendEmail } from "@/lib/email";

/**
 * The sandbox rule is the only thing standing between a demo visitor and a
 * real email to an invented person, so it is tested at the boundary rather
 * than trusted to the call sites that consult it.
 */

test("a sandbox workspace simulates everything in it", () => {
  assert.equal(isSimulated({ orgIsSample: true, recordIsSample: false }), true);
});

test("a sample record simulates even inside a real workspace", () => {
  // The case that matters: a paying customer loaded sample data, and a
  // follow-up is addressed to maya@nordform.ai, who does not exist.
  assert.equal(isSimulated({ orgIsSample: false, recordIsSample: true }), true);
});

test("a real record in a real workspace is not simulated", () => {
  assert.equal(isSimulated({ orgIsSample: false, recordIsSample: false }), false);
  assert.equal(isSimulated({}), false);
});

test("missing flags never accidentally enable real sends", () => {
  assert.equal(isSimulated({ orgIsSample: null, recordIsSample: null }), false);
  assert.equal(isSimulated({ orgIsSample: undefined }), false);
});

test("simulated ids are recognisable as simulated", () => {
  const id = simulatedId();
  assert.ok(id.startsWith(SIMULATED_ID_PREFIX));
  assert.equal(isSimulatedId(id), true);
  assert.equal(isSimulatedId("re_abc123"), false);
  assert.equal(isSimulatedId(null), false);
});

test("a sandbox send is suppressed even when an API key is configured", async () => {
  const previous = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = "re_test_key_that_must_never_be_used";
  try {
    const result = await sendEmail({
      to: "maya@nordform.ai",
      subject: "This must not be delivered",
      body: "…",
      orgApiKey: "re_org_key_that_must_never_be_used",
      sandbox: true,
    });
    assert.equal(result.sandbox, true);
    assert.equal(result.simulated, true);
    assert.ok(isSimulatedId(result.id));
  } finally {
    if (previous === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previous;
  }
});

test("without a key a normal send is simulated but not sandboxed", async () => {
  const previous = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  try {
    const result = await sendEmail({
      to: "someone@example.com",
      subject: "s",
      body: "b",
    });
    // Simulated for want of a key is a different fact from sandboxed, and the
    // audit log says something different for each.
    assert.equal(result.simulated, true);
    assert.equal(result.sandbox, false);
  } finally {
    if (previous !== undefined) process.env.RESEND_API_KEY = previous;
  }
});
