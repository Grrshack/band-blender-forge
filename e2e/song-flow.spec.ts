import type { Locator } from "@playwright/test";
import { clickMenu, expect, openTool, test } from "./helpers";

const visible = (l: Locator) => l.filter({ visible: true }).first();

/** The main path: blend → lyrics → Suno Sheet → song pack, then reload and pick it back up. */
test("blend, write lyrics, export a song pack, reopen it", async ({ page }) => {
  await openTool(page, "blend");
  await page.getByPlaceholder("Primary artist").fill("Test Artist One");
  await page.getByPlaceholder("Second artist (optional)").fill("Test Artist Two");
  await page.getByRole("button", { name: /^Run Blend/ }).click();

  // The canned blend arrives as a tag list, with the Studio Brief one tap away.
  await expect(page.getByText(/dark synthpop, cinematic/).first()).toBeVisible();
  const formats = page.getByRole("radiogroup", { name: "Style format" }).first();
  await formats.getByRole("radio", { name: "Studio brief" }).click();
  await expect(page.getByText("Breathy female alto, close and upfront").first()).toBeVisible();
  await formats.getByRole("radio", { name: "Tag list" }).click();

  // Lyrics, with a rough time on each section.
  await clickMenu(page, "Lyric Forge");
  await page.getByRole("button", { name: /^Forge Lyrics/ }).click();
  await expect(visible(page.getByText("[Verse 1]", { exact: true }))).toBeVisible();
  await expect(page.getByText(/at 92 BPM/)).toBeVisible();
  await expect(visible(page.getByText(/^\d:\d\d–\d:\d\d$/))).toBeVisible();

  // Suno Sheet: every box filled, nothing blocking.
  await clickMenu(page, "Suno Sheet");
  await expect(page.locator("main").getByText("[Chorus]").first()).toBeAttached();
  await expect(page.getByLabel("Pre-flight check")).not.toContainText("No title yet");
  await expect(page.getByLabel("Pre-flight check")).not.toContainText("No lyrics yet");

  // Export → Song pack downloads a real zip with the Suno files in it.
  await page.getByRole("button", { name: /^Export/ }).first().click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByText("Song pack (.zip)").click()]);
  expect(download.suggestedFilename()).toMatch(/song-pack\.zip$/);
  const zip = await download.createReadStream().then(async (s) => {
    const chunks: Buffer[] = [];
    for await (const c of s) chunks.push(c as Buffer);
    return Buffer.concat(chunks);
  });
  expect(zip.subarray(0, 4).toString("hex")).toBe("504b0304");
  const names = zip.toString("latin1");
  for (const f of ["README.txt", "suno/style.txt", "suno/lyrics.txt", "suno/title.txt", "lyrics/timeline.txt", "brief.md"]) {
    expect(names, `zip has ${f}`).toContain(f);
  }

  // Saved in this browser: reload and pick it back up.
  await page.waitForTimeout(1600); // autosave runs 1.2 s after the last change
  await page.reload();
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await clickMenu(page, "Lyric Forge");
  await expect(visible(page.getByText("[Verse 1]", { exact: true }))).toBeVisible();
});

test("the Start here chat sets up a blend", async ({ page }) => {
  await openTool(page, "assistant");
  await page.getByPlaceholder(/Describe a sound or tweak the blend/).fill("Dark synthpop for a rainy night drive");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  // It fills in the Band Blender from the canned answer and runs the blend.
  await expect(page.getByPlaceholder("Primary artist")).toHaveValue("Test Artist One");
  await expect(page.getByText(/dark synthpop, cinematic/).first()).toBeVisible();
});
