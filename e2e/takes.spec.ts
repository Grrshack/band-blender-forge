import { clickMenu, expect, openTool, test } from "./helpers";

/**
 * Alternate takes and Suno's advanced options, end to end on the site:
 * make takes → flip tabs → the Suno Sheet follows the open tab → Send to Suno carries every take,
 * the open one, vocal gender and the sliders. The extension itself is stood in for by the page mark
 * and a recorder on postMessage (the real extension is tested on its own against stand-in Suno pages).
 */
test("make alternate takes, pick one, and send it with Suno's options", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __sent: unknown[] }).__sent = [];
    window.addEventListener("message", (e) => {
      const d = e.data as { source?: string; type?: string; payload?: unknown; openSuno?: boolean };
      if (d?.source === "band-blender" && d.type === "send-to-suno") {
        (window as unknown as { __sent: unknown[] }).__sent.push(d.payload);
        (window as unknown as { __openSuno?: boolean }).__openSuno = d.openSuno;
      }
    });
  });

  await openTool(page, "blend");
  // The extension's page mark, set after hydration (setting it earlier only trips a dev-mode warning).
  await page.evaluate(() => (document.documentElement.dataset["bbExtension"] = "1.1.0"));
  await page.getByPlaceholder("Primary artist").fill("Test Artist One");
  await page.getByRole("button", { name: /^Run Blend/ }).click();
  await expect(page.getByText(/dark synthpop, cinematic/).first()).toBeVisible();

  // Default chips are Darker + Bigger drop; one AI call makes both.
  await page.getByRole("button", { name: /^Make 2 takes/ }).first().click();
  const tabs = page.getByRole("tablist", { name: "Takes" }).first();
  await expect(tabs.getByRole("tab", { name: "Main" })).toBeVisible();
  await expect(tabs.getByRole("tab", { name: "Darker" })).toBeVisible();
  await expect(tabs.getByRole("tab", { name: "Bigger drop" })).toBeVisible();

  await tabs.getByRole("tab", { name: "Darker" }).click();
  await expect(tabs.getByRole("tab", { name: "Darker" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText(/darker take/).first()).toBeVisible();

  // Lyrics so the sheet has something to send, then the Suno Sheet shows the open take.
  await clickMenu(page, "Lyric Forge");
  await page.getByRole("button", { name: /^Forge Lyrics/ }).click();
  await expect(page.getByText("[Verse 1]", { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await clickMenu(page, "Suno Sheet");
  const sheetTabs = page.getByRole("tablist", { name: "Takes" }).filter({ visible: true }).first();
  await expect(sheetTabs.getByRole("tab", { name: "Darker" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("main").getByText(/darker take/).first()).toBeAttached();

  // Suno's advanced options: Female, Weirdness on (starts at 40), Style Influence via the Explore preset.
  await page.getByText("Suno's advanced options").click();
  await page.getByRole("radiogroup", { name: "Vocal gender" }).getByRole("radio", { name: "Female" }).click();
  await page.getByRole("button", { name: /Explore/ }).click();
  await expect(page.getByLabel("Weirdness percent")).toHaveValue("40");
  await expect(page.getByText(/Fill sets these|fills these in Suno/).first()).toBeVisible();

  // Send: every take goes, the open one is marked, options ride along.
  // Extension 1.1 is asked to open (or switch to) Suno; no answer here, so the site opens it after a second.
  await page.context().route("https://suno.com/**", (r) => r.fulfill({ contentType: "text/html", body: "<!doctype html><title>Suno</title>" }));
  const opened = page.waitForEvent("popup", { timeout: 5000 });
  await page.getByRole("button", { name: /^Send to Suno/ }).filter({ visible: true }).first().click();
  expect((await opened).url()).toBe("https://suno.com/create");
  await page.waitForFunction(() => (window as unknown as { __sent: unknown[] }).__sent.length > 0);
  const sent = (await page.evaluate(() => (window as unknown as { __sent: unknown[] }).__sent.at(-1))) as {
    style: string;
    takes?: Array<{ label: string; style: string }>;
    activeTake?: number;
    vocalGender?: string;
    weirdness?: number;
    styleInfluence?: number;
    instrumental?: boolean;
  };
  expect(await page.evaluate(() => (window as unknown as { __openSuno?: boolean }).__openSuno)).toBe(true);
  expect(sent.style).toContain("darker take");
  expect(sent.takes?.map((t) => t.label)).toEqual(["Main", "Darker", "Bigger drop"]);
  expect(sent.activeTake).toBe(1);
  expect(sent.vocalGender).toBe("female");
  expect(sent.weirdness).toBe(40);
  expect(sent.styleInfluence).toBe(85);
  expect(sent.instrumental).toBe(false); // sung lines: Fill switches Instrumental off if it was left on

  // Removing a take falls back to Main when it was the open one.
  await clickMenu(page, "Band Blender");
  await page.getByRole("button", { name: "Remove the Darker take" }).first().click();
  const left = page.getByRole("tablist", { name: "Takes" }).first();
  await expect(left.getByRole("tab", { name: "Main" })).toHaveAttribute("aria-selected", "true");
  await expect(left.getByRole("tab", { name: "Darker" })).toHaveCount(0);
});
