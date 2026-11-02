import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GOOGLE_CALLBACK_PATH,
  googleOAuthOrigin,
  googleRedirectUri,
  isLocalOrigin,
  resolveOAuthOrigin,
} from "@/lib/google-oauth";

/**
 * The redirect URI has to equal a string registered in Google's console
 * exactly. Everything here guards that equality, because the failure mode is
 * not a caught exception — it is Google refusing every sign-in with
 * redirect_uri_mismatch, which no test inside this codebase would otherwise
 * notice.
 */

const CANONICAL = "https://selryn-mu.vercel.app";

function withOrigin<T>(value: string | undefined, fn: () => T): T {
  const previous = process.env.GOOGLE_OAUTH_ORIGIN;
  if (value === undefined) delete process.env.GOOGLE_OAUTH_ORIGIN;
  else process.env.GOOGLE_OAUTH_ORIGIN = value;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_OAUTH_ORIGIN;
    else process.env.GOOGLE_OAUTH_ORIGIN = previous;
  }
}

test("a second alias is pulled onto the canonical origin", () => {
  withOrigin(CANONICAL, () => {
    assert.equal(resolveOAuthOrigin("https://sellora-mu.vercel.app"), CANONICAL);
  });
});

test("a per-deployment preview URL is pulled onto it too", () => {
  // The case that could never be registered: a fresh host every deploy.
  withOrigin(CANONICAL, () => {
    assert.equal(
      resolveOAuthOrigin("https://selryn-8e2dxjwid-itsxuanxi-growthos.vercel.app"),
      CANONICAL
    );
  });
});

test("the canonical origin resolves to itself, so there is no redirect loop", () => {
  withOrigin(CANONICAL, () => {
    assert.equal(resolveOAuthOrigin(CANONICAL), CANONICAL);
  });
});

test("a pasted trailing slash or path cannot cause a loop", () => {
  // `origin !== requestOrigin` drives a redirect, so an un-normalized value
  // would bounce the visitor forever between two spellings of one origin.
  for (const sloppy of [
    `${CANONICAL}/`,
    `${CANONICAL}/api/auth/callback/google`,
    `  ${CANONICAL}  `,
  ]) {
    withOrigin(sloppy, () => {
      assert.equal(googleOAuthOrigin(), CANONICAL);
      assert.equal(resolveOAuthOrigin(CANONICAL), CANONICAL);
    });
  }
});

test("local development keeps its own origin, whatever is configured", () => {
  withOrigin(CANONICAL, () => {
    assert.equal(resolveOAuthOrigin("http://localhost:3400"), "http://localhost:3400");
    assert.equal(resolveOAuthOrigin("http://127.0.0.1:3000"), "http://127.0.0.1:3000");
  });
});

test("an unset variable leaves the previous behaviour untouched", () => {
  withOrigin(undefined, () => {
    assert.equal(
      resolveOAuthOrigin("https://sellora-mu.vercel.app"),
      "https://sellora-mu.vercel.app"
    );
  });
});

test("a malformed value falls back rather than taking sign-in down", () => {
  withOrigin("not a url", () => {
    assert.equal(googleOAuthOrigin(), null);
    assert.equal(resolveOAuthOrigin("https://example.com"), "https://example.com");
  });
});

test("localhost detection does not mistake a lookalike host for local", () => {
  assert.equal(isLocalOrigin("http://localhost:3400"), true);
  assert.equal(isLocalOrigin("http://app.localhost:3400"), true);
  // A registered domain that merely ends in the word must not count.
  assert.equal(isLocalOrigin("https://notlocalhost.com"), false);
  assert.equal(isLocalOrigin("https://localhost.attacker.com"), false);
});

test("both halves of the flow build the identical redirect_uri", () => {
  withOrigin(CANONICAL, () => {
    const authorization = googleRedirectUri(resolveOAuthOrigin("https://sellora-mu.vercel.app"));
    const exchange = googleRedirectUri(resolveOAuthOrigin(CANONICAL));
    assert.equal(authorization, exchange);
    assert.equal(authorization, `${CANONICAL}${GOOGLE_CALLBACK_PATH}`);
  });
});
