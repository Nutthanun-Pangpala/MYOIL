import { expect, test } from "@playwright/test";
import { login, resetData } from "./helpers";

/** OBS-33 (test round 13): on a 375 px phone the office pages must not be wider than the screen; wide tables scroll inside their own frame */
test.use({ viewport: { width: 375, height: 800 } });
test.beforeAll(() => resetData());

for (const path of ["/issues/new", "/settings/users", "/purchases", "/ledger", "/monthly"]) {
  test(`${path} fits a 375 px screen`, async ({ page }) => {
    await login(page, "admin");
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    // which elements stick out past the screen without a scrolling frame around them (for the failure message)
    const wide = await page.evaluate(() => {
      const out: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>("body *")) {
        const r = el.getBoundingClientRect();
        if (r.right <= window.innerWidth + 1) continue;
        let p = el.parentElement;
        let framed = false;
        while (p && p !== document.body) {
          const cs = getComputedStyle(p);
          // an absolutely placed element is only held by a frame that is itself positioned
          const holds = getComputedStyle(el).position !== "absolute" || cs.position !== "static";
          if (holds && (cs.overflowX === "auto" || cs.overflowX === "scroll" || cs.overflowX === "hidden")) framed = true;
          p = p.parentElement;
        }
        if (!framed) out.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} → right ${Math.round(r.right)}`);
      }
      return { page: document.documentElement.scrollWidth, out: out.slice(0, 8) };
    });
    expect(wide.out, `page is ${wide.page}px wide`).toEqual([]);
    expect(wide.page).toBeLessThanOrEqual(376);
  });
}
