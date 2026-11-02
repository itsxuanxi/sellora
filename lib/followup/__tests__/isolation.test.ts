import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * Workspaces share one database, so a query that reaches a row by id alone is
 * a cross-tenant read. There is no way to prove that with a unit test and no
 * database, but the mistake has a shape: a Prisma call whose `where` has no
 * `orgId`. This asserts the shape, over every file in the follow-up layer, so
 * a new query cannot be added without the filter.
 */

/**
 * Every directory that queries on behalf of one agency.
 *
 * Widened as the product grew: a guard that covers the first module written
 * and not the next three is a guard that passes while the hole opens.
 */
const ROOTS = [
  path.join(process.cwd(), "lib", "followup"),
  path.join(process.cwd(), "lib", "deal-facts"),
  path.join(process.cwd(), "lib", "recovery"),
  path.join(process.cwd(), "app", "(app)", "dashboard"),
  path.join(process.cwd(), "app", "(app)", "opportunities"),
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "__tests__" ? [] : sourceFiles(full);
    }
    return entry.name.endsWith(".ts") ? [full] : [];
  });
}

/** Every `db.<model>.<method>(` call, with the argument object that follows. */
function prismaCalls(source: string): { call: string; args: string; callIndex: number }[] {
  const calls: { call: string; args: string; callIndex: number }[] = [];
  const re = /db\.([a-zA-Z]+)\.([a-zA-Z]+)\(/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(source)) !== null) {
    const callIndex = m.index;
    // Walk to the matching close paren so nested objects are captured whole.
    let depth = 0;
    let i = re.lastIndex - 1;
    for (; i < source.length; i++) {
      if (source[i] === "(") depth++;
      else if (source[i] === ")") {
        depth--;
        if (depth === 0) break;
      }
    }
    calls.push({
      call: `${m[1]}.${m[2]}`,
      args: source.slice(re.lastIndex, i),
      callIndex,
    });
  }
  return calls;
}

/** Reads that cannot leak across workspaces because they take no filter. */
const UNSCOPED_SAFE = new Set(["$transaction", "$queryRaw", "$executeRaw"]);

/**
 * How far back to look for the ownership check that makes a write safe.
 *
 * `update({ where: { id } })` is legitimate when the row was just fetched
 * with an orgId filter — the id is then already proven to belong to the
 * caller. Allowlisting the method name instead would let a genuinely
 * unscoped `opportunity.update` through later, so the test looks for the
 * check rather than trusting the method.
 */
const OWNERSHIP_WINDOW = 1_200;

function hasNearbyOwnershipCheck(source: string, callIndex: number): boolean {
  const start = Math.max(0, callIndex - OWNERSHIP_WINDOW);
  const preceding = source.slice(start, callIndex);
  // The read that proves ownership, and the session it was scoped by.
  return /orgId/.test(preceding) && /\b(findFirst|findUnique|findMany|count)\b/.test(preceding);
}

test("every query is scoped to one workspace", () => {
  const files = ROOTS.flatMap(sourceFiles);
  assert.ok(files.length > 0, "found no source files to check");

  const offenders: string[] = [];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const { call, args, callIndex } of prismaCalls(source)) {
      if (UNSCOPED_SAFE.has(call)) continue;
      if (/\borgId\b/.test(args)) continue;
      if (hasNearbyOwnershipCheck(source, callIndex)) continue;
      {
        offenders.push(
          `${path.relative(process.cwd(), file)} → db.${call}(…) has no orgId`
        );
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `every query must filter by orgId:\n${offenders.join("\n")}`
  );
});

test("the check can actually fail", () => {
  // A guard that cannot fail is not a guard. This is the shape it catches.
  const bad = `const x = await db.opportunity.findMany({ where: { id: { in: ids } } });`;
  const [call] = prismaCalls(bad);
  assert.equal(call.call, "opportunity.findMany");
  assert.ok(!/\borgId\b/.test(call.args));

  const good = `await db.opportunity.findMany({ where: { orgId, id: { in: ids } } });`;
  assert.ok(/\borgId\b/.test(prismaCalls(good)[0].args));
});
