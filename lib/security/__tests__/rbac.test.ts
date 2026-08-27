import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ForbiddenError,
  ROLES,
  can,
  permissionsFor,
  requirePermission,
  toRole,
  type Permission,
} from "@/lib/security/rbac";

/** The permissions that let someone reach a customer's systems or data. */
const DANGEROUS: Permission[] = [
  "integration:connect",
  "integration:revoke",
  "data:export",
  "member:manage",
];

test("an unknown role gets the least privilege, not the most", () => {
  // Old rows will carry strings this build has never seen. The safe failure
  // is "cannot".
  assert.equal(toRole("superuser"), "viewer");
  assert.equal(toRole(null), "viewer");
  assert.equal(toRole(undefined), "viewer");
  assert.equal(toRole(""), "viewer");
  assert.equal(can("superuser", "integration:connect"), false);
  assert.equal(can(null, "data:export"), false);
});

test("a viewer can only read", () => {
  const granted = permissionsFor("viewer");
  assert.deepEqual([...granted].sort(), ["analytics:read", "opportunity:read"]);
});

test("only owners and admins hold the dangerous permissions", () => {
  for (const permission of DANGEROUS) {
    assert.equal(can("owner", permission), true, `owner should hold ${permission}`);
    assert.equal(can("admin", permission), true, `admin should hold ${permission}`);
    for (const role of ["manager", "rep", "viewer"]) {
      assert.equal(can(role, permission), false, `${role} must not hold ${permission}`);
    }
  }
});

test("a rep may approve outbound but may not write back to the shared CRM", () => {
  assert.equal(can("rep", "action:approve"), true);
  assert.equal(can("rep", "action:execute"), false);
  // A manager owns the shared state.
  assert.equal(can("manager", "action:execute"), true);
});

test("only the owner can delete the organization", () => {
  assert.equal(can("owner", "org:delete"), true);
  for (const role of ["admin", "manager", "rep", "viewer"]) {
    assert.equal(can(role, "org:delete"), false);
  }
});

test("privilege is monotonic up the ladder", () => {
  // Every role holds at least what the one below it holds. A gap here would
  // mean a promotion silently removing an ability.
  const ladder = ["viewer", "rep", "manager", "admin", "owner"] as const;
  for (let i = 1; i < ladder.length; i++) {
    const lower = permissionsFor(ladder[i - 1]);
    const higher = new Set(permissionsFor(ladder[i]));
    for (const p of lower) {
      assert.ok(higher.has(p), `${ladder[i]} lost "${p}" held by ${ladder[i - 1]}`);
    }
  }
});

test("requirePermission throws for the denied and passes for the allowed", () => {
  assert.throws(() => requirePermission("viewer", "integration:connect"), ForbiddenError);
  assert.doesNotThrow(() => requirePermission("owner", "integration:connect"));
});

test("the thrown error names the permission without leaking internals", () => {
  try {
    requirePermission("rep", "data:export");
    assert.fail("should have thrown");
  } catch (err) {
    assert.ok(err instanceof ForbiddenError);
    assert.equal(err.permission, "data:export");
    assert.match(err.message, /sales rep/i);
  }
});

test("every declared role has an explicit grant list", () => {
  // A role in ROLES with no grants would silently behave as a viewer.
  for (const role of ROLES) {
    assert.ok(Array.isArray(permissionsFor(role)), `${role} has no grants`);
    assert.ok(permissionsFor(role).length > 0, `${role} grants nothing`);
  }
});
