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

const ROOT = path.join(process.cwd(), "lib", "followup");

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
function prismaCalls(source: string): { call: string; args: string }[] {
  const calls: { call: string; args: string }[] = [];
  const re = /db\.([a-zA-Z]+)\.([a-zA-Z]+)\(/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(source)) !== null) {
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
    });
  }
  return calls;
}

/** Reads that cannot leak across workspaces because they take no filter. */
const UNSCOPED_SAFE = new Set(["$transaction", "$queryRaw", "$executeRaw"]);

test("every follow-up query is scoped to one workspace", () => {
  const files = sourceFiles(ROOT);
  assert.ok(files.length > 0, "found no source files to check");

  const offenders: string[] = [];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const { call, args } of prismaCalls(source)) {
      if (UNSCOPED_SAFE.has(call)) continue;
      if (!/\borgId\b/.test(args)) {
        offenders.push(`${path.relative(ROOT, file)} → db.${call}(…) has no orgId`);
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
