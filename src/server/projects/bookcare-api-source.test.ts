import { describe, expect, it } from "vitest";
import { BookcareApiProjectSource, ProjectListError, toProjectRecords } from "./bookcare-api-source";

const row = { refCode: "PCOB", projectCode: "6601", name: "โครงการ ก", isActive: true };

describe("toProjectRecords", () => {
  it("reads the wrapped list and the snake_case spelling", () => {
    expect(toProjectRecords({ projects: [row] })).toEqual([row]);
    expect(toProjectRecords([{ ref_code: "X1", project_code: null, name: "ข", is_active: false }])).toEqual([{ refCode: "X1", projectCode: null, name: "ข", isActive: false }]);
  });
  it("refuses an empty list so a broken answer cannot switch every project off", () => {
    expect(() => toProjectRecords({ projects: [] })).toThrow(ProjectListError);
  });
  it("refuses a row without code or name, and repeated codes", () => {
    expect(() => toProjectRecords([{ refCode: "", name: "x" }])).toThrow(/แถวที่ 1/);
    expect(() => toProjectRecords([row, row])).toThrow(/ซ้ำ/);
    expect(() => toProjectRecords("nope")).toThrow(ProjectListError);
  });
});

describe("BookcareApiProjectSource", () => {
  const env = { BOOKCARE_API_URL: "https://bookcare.example/", BOOKCARE_PULL_KEY: "k".repeat(40) };
  it("calls API 7 with the key", async () => {
    let seen: { url: string; auth: string | null } | null = null;
    const fake = (async (url: string, init: RequestInit) => {
      seen = { url, auth: new Headers(init.headers).get("authorization") };
      return Response.json({ projects: [row] });
    }) as unknown as typeof fetch;
    expect(await new BookcareApiProjectSource(env, fake).list()).toEqual([row]);
    expect(seen).toEqual({ url: "https://bookcare.example/api/myoil/v1/projects", auth: `Bearer ${env.BOOKCARE_PULL_KEY}` });
  });
  it("says what went wrong without echoing the key", async () => {
    const f401 = (async () => new Response("no", { status: 401 })) as unknown as typeof fetch;
    await expect(new BookcareApiProjectSource(env, f401).list()).rejects.toThrow(/401/);
    await expect(new BookcareApiProjectSource({}, f401).list()).rejects.toThrow(/BOOKCARE_API_URL/);
    const down = (async () => { throw new Error("secret-host"); }) as unknown as typeof fetch;
    await expect(new BookcareApiProjectSource(env, down).list()).rejects.not.toThrow(/secret-host/);
  });
});
