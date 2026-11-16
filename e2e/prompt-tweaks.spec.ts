import { clickMenu, expect, openTool, test } from "./helpers";

/**
 * Patch 27: the Short vs Full length test, cues and singers inside section tags, the duet check,
 * song shifts in Lyric Forge, and the Short tab on Quick song.
 */
test("every blend comes back Full and Short; the open tab is what the Suno Sheet uses", async ({ page }) => {
  await openTool(page, "blend");
  await page.getByPlaceholder("Primary artist").fill("Test Artist One");
  await page.getByRole("button", { name: /^Run Blend/ }).click();
  const tabs = page.getByRole("tablist", { name: "Takes" }).first();
  await expect(tabs.getByRole("tab", { name: "Main" })).toHaveAttribute("aria-selected", "true");
  await tabs.getByRole("tab", { name: "Short" }).click();
  await expect(page.getByText(/Length test: the same sound in 4–7 descriptors/).first()).toBeVisible();

  await clickMenu(page, "Suno Sheet");
  const sheetTabs = page.getByRole("tablist", { name: "Takes" }).filter({ visible: true }).first();
  await expect(sheetTabs.getByRole("tab", { name: "Short" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("main").getByText("dark synthpop, melancholic, analog bass, arpeggiated synths, breathy female vocal upfront").first()).toBeAttached();
});

test("singers and cues go inside the tags; two singers prompt for 'duet'; song shifts add tags", async ({ page }) => {
  await openTool(page, "blend");
  await page.getByPlaceholder("Primary artist").fill("Test Artist One");
  await page.getByRole("button", { name: /^Run Blend/ }).click();
  await expect(page.getByText(/dark synthpop, cinematic/).first()).toBeVisible();

  await clickMenu(page, "Lyric Forge");
  await page.getByRole("button", { name: /^Forge Lyrics/ }).click();
  await expect(page.getByText("[Verse 1]", { exact: true }).filter({ visible: true }).first()).toBeVisible();

  // Verse 1 sung by a man, the chorus by a woman.
  await page.getByLabel("Singer for [Verse 1]").selectOption("male");
  await page.getByLabel("Singer for [Chorus]").first().selectOption("female");
  await expect(page.getByRole("note").filter({ hasText: /Two singers/ })).toBeVisible();

  // Song shifts.
  await page.getByRole("button", { name: /Build \+ drop before the last chorus/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "Added a build and a drop before the last chorus." })).toBeVisible();
  await expect(page.getByText("[Drop]", { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await page.getByRole("button", { name: /Key change on the last chorus/ }).click();

  // The Suno Sheet: tags carry singer and cue; the pre-flight asks for "duet" and adds it.
  await clickMenu(page, "Suno Sheet");
  const main = page.locator("main");
  await expect(main.getByText(/\[Verse 1 \| Male Vocal \| Whispered \| Sparse\]/).first()).toBeAttached();
  await expect(main.getByText(/\[Chorus \| Female Vocal/).first()).toBeAttached();
  await expect(main.getByText(/Key change \| Stacked harmonies\]/).first()).toBeAttached();
  await expect(page.getByText(/doesn't say "duet"/)).toBeVisible();
  await page.getByRole("button", { name: 'Add "duet"' }).click();
  await expect(page.getByText(/doesn't say "duet"/)).toHaveCount(0);
  await expect(main.getByText(/dark synthpop, duet, cinematic/).first()).toBeAttached();
});

test("the lead vocal tag goes on top when no section names a singer", async ({ page }) => {
  await openTool(page, "blend");
  await page.getByPlaceholder("Primary artist").fill("Test Artist One");
  await page.getByRole("button", { name: /^Run Blend/ }).click();
  await expect(page.getByText(/dark synthpop, cinematic/).first()).toBeVisible();
  await clickMenu(page, "Lyric Forge");
  await page.getByRole("button", { name: /^Forge Lyrics/ }).click();
  await expect(page.getByText("[Verse 1]", { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await clickMenu(page, "Suno Sheet");
  await expect(page.locator("main").getByText(/^\[Female Vocal\]\s+\[Intro \| Synths swell\]/).first()).toBeAttached();
});

test("Quick song shows the Main and Short tabs", async ({ page }) => {
  await openTool(page, "quick");
  await page.getByRole("button", { name: /moody synth-pop breakup song/ }).click();
  await page.getByRole("button", { name: /Make my song/ }).click();
  await expect(page.getByTestId("quick-style")).toContainText("dark synthpop, cinematic");
  await page.getByRole("tablist", { name: "Takes" }).getByRole("tab", { name: "Short" }).click();
  await expect(page.getByTestId("quick-style")).toHaveText("dark synthpop, melancholic, analog bass, arpeggiated synths, breathy female vocal upfront");
});
