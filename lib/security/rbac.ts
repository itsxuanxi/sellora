import "server-only";

/**
 * Role-based access control.
 *
 * Two rules this module exists to enforce:
 *
 *   1. Permission is checked on the server, in the code path that performs the
 *      action. Hiding a button is a courtesy to the user, not a control.
 *   2. An unknown role gets the least privilege, not the most. New roles will
 *      be added, old rows will carry strings this build has never seen, and
 *      the safe failure is "cannot", not "can".
 *
 * The dangerous permissions are deliberately narrow. Connecting an integration
 * hands Sellora standing access to a customer's CRM; approving a CRM write
 * changes data Sellora does not own; exporting data moves it out of the
 * tenant. Those three are owner/admin territory.
 */

export const ROLES = ["owner", "admin", "manager", "rep", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  rep: "Sales rep",
  viewer: "Viewer",
};

export type Permission =
  // Reading the workspace
  | "opportunity:read"
  | "analytics:read"
  // Working deals
  | "opportunity:write"
  | "recommendation:dismiss"
  // Anything that leaves Sellora and touches a customer's systems or buyers
  | "action:approve"
  | "action:execute"
  // Administration
  | "integration:connect"
  | "integration:revoke"
  | "playbook:write"
  | "member:manage"
  | "data:export"
  | "org:delete";

/**
 * Grants per role. Written out in full rather than by inheritance: a reader
 * checking whether a rep can approve a CRM write should be able to see the
 * answer, not derive it from a chain of spreads.
 */
const GRANTS: Record<Role, Permission[]> = {
  viewer: ["opportunity:read", "analytics:read"],

  rep: [
    "opportunity:read",
    "analytics:read",
    "opportunity:write",
    "recommendation:dismiss",
    // A rep may approve outbound to their own buyers. They may not execute
    // writes back into the CRM: that is shared state for the whole team.
    "action:approve",
  ],

  manager: [
    "opportunity:read",
    "analytics:read",
    "opportunity:write",
    "recommendation:dismiss",
    "action:approve",
    "action:execute",
    "playbook:write",
  ],

  admin: [
    "opportunity:read",
    "analytics:read",
    "opportunity:write",
    "recommendation:dismiss",
    "action:approve",
    "action:execute",
    "playbook:write",
    "integration:connect",
    "integration:revoke",
    "member:manage",
    "data:export",
  ],

  owner: [
    "opportunity:read",
    "analytics:read",
    "opportunity:write",
    "recommendation:dismiss",
    "action:approve",
    "action:execute",
    "playbook:write",
    "integration:connect",
    "integration:revoke",
    "member:manage",
    "data:export",
    "org:delete",
  ],
};

/** Normalises a stored role string. Unknown values fall to the least privilege. */
export function toRole(stored: string | null | undefined): Role {
  return (ROLES as readonly string[]).includes(stored ?? "")
    ? (stored as Role)
    : "viewer";
}

export function can(role: string | null | undefined, permission: Permission): boolean {
  return GRANTS[toRole(role)].includes(permission);
}

export class ForbiddenError extends Error {
  readonly permission: Permission;
  constructor(permission: Permission, role: Role) {
    super(`A ${ROLE_LABELS[role].toLowerCase()} cannot ${permission.replace(":", " ")}.`);
    this.name = "ForbiddenError";
    this.permission = permission;
  }
}

/**
 * Throws unless the role grants the permission.
 *
 * Call this at the top of every server action that mutates anything, before
 * the work rather than around it, so a missing check is visible as an absence
 * at the top of the function.
 */
export function requirePermission(
  role: string | null | undefined,
  permission: Permission
): void {
  if (!can(role, permission)) throw new ForbiddenError(permission, toRole(role));
}

/** Every permission a role holds, for rendering the members screen. */
export function permissionsFor(role: string | null | undefined): Permission[] {
  return [...GRANTS[toRole(role)]];
}
