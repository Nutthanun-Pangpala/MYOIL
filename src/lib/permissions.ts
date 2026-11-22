import type { Role } from "./labels";

/**
 * Who may do what — one table, so screens and server actions ask the same question.
 * Pure (no cookies, no DB): the session layer passes the role in.
 * system_admin can do everything store_admin can (brief §3).
 */
type Actor = { role: Role };

/** keys, records, prices, purchases, stock checks, close a cycle */
export const canWriteFuel = (a: Actor) => a.role === "store_admin" || a.role === "system_admin";

/** reopen a closed cycle, manage users — system_admin only */
export const canAdminister = (a: Actor) => a.role === "system_admin";

/** project_viewer is limited to their projects; everyone else sees all */
export const seesAllProjects = (a: Actor) => a.role !== "project_viewer";

/** executive and project_viewer are read-only */
export const isReadOnly = (a: Actor) => !canWriteFuel(a);
