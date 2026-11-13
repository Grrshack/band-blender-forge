import { TOOLS, clickMenu, expect, expectToolShown, openTool, test } from "./helpers";

test.describe("every tool opens without errors @phone", () => {
  for (const tool of TOOLS) {
    test(`${tool.label} @phone`, async ({ page }) => {
      await openTool(page, tool.tab);
      // Something real rendered, not an empty shell.
      const text = await page.locator("main").innerText();
      expect(text.length).toBeGreaterThan(80);
    });
  }
});

test("the side menu opens every tool", async ({ page }) => {
  await openTool(page, "assistant");
  for (const tool of TOOLS) {
    await clickMenu(page, tool.label);
    await expectToolShown(page);
  }
});

const PUBLIC_PAGES = [
  "/",
  "/guides",
  "/guides/send-to-suno-extension",
  "/tools",
  "/tools/bpm-key-finder",
  "/tools/lyric-checker",
  "/tools/release-checklist",
  "/tools/suno-metatags",
  "/tools/suno-prompt-checker",
  "/privacy",
  "/auth",
];

test.describe("public pages load @phone", () => {
  for (const path of PUBLIC_PAGES) {
    test(`${path} @phone`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status(), `status for ${path}`).toBeLessThan(400);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("h1, h2").first()).toBeVisible();
    });
  }
});

test("collapsed sections show an arrow and open on click", async ({ page }) => {
  await openTool(page, "suno");
  const fold = page.locator("details", { hasText: "Suno settings: a three-pass routine" });
  await expect(fold.locator("summary svg").last()).toBeVisible();
  await expect(fold).not.toHaveAttribute("open", "");
  await fold.locator("summary").click();
  await expect(fold).toHaveAttribute("open", "");
});
