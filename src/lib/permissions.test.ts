import { describe, expect, it } from "vitest";
import { canAdminister, canWriteFuel, isReadOnly, seesAllProjects } from "./permissions";

describe("permissions", () => {
  it("system_admin can do everything store_admin can, plus administer", () => {
    expect(canWriteFuel({ role: "store_admin" })).toBe(true);
    expect(canWriteFuel({ role: "system_admin" })).toBe(true);
    expect(canAdminister({ role: "store_admin" })).toBe(false);
    expect(canAdminister({ role: "system_admin" })).toBe(true);
  });
  it("executive and project_viewer are read-only", () => {
    expect(isReadOnly({ role: "executive" })).toBe(true);
    expect(isReadOnly({ role: "project_viewer" })).toBe(true);
  });
  it("only project_viewer is limited to own projects", () => {
    expect(seesAllProjects({ role: "project_viewer" })).toBe(false);
    expect(seesAllProjects({ role: "executive" })).toBe(true);
  });
});
