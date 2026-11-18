import type { Page } from "@playwright/test";
import { clickMenu, expect, openTool, test } from "./helpers";

async function makeBlend(page: Page) {
  await openTool(page, "blend");
  await page.getByPlaceholder("Primary artist").fill("Test Artist One");
  await page.getByRole("button", { name: /^Run Blend/ }).click();
  await expect(page.getByText(/dark synthpop, cinematic/).first()).toBeVisible();
}

/** Artist card: one AI call makes the act; it downloads, names the release, and feeds Bio & Pitch. */
test("Bio & Pitch makes an artist card and writes about the act", async ({ page }) => {
  await makeBlend(page);
  await clickMenu(page, "Bio & Pitch");
  await page.getByLabel("Lineup").selectOption("duo");
  await page.getByRole("button", { name: /Make my artist card/ }).click();

  const card = page.getByTestId("artist-card");
  await expect(card).toContainText("Glass Harbor");
  await expect(card).toContainText("Mara Venn");
  await expect(card).toContainText("Made with Band Blender");
  await expect(page.getByText(/rain-soaked coats/i).first()).toBeVisible();

  // The image downloads.
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Download image/ }).click()]);
  expect(download.suggestedFilename()).toBe("glass-harbor-artist-card.png");

  // Renaming the act updates the card; then it becomes the release's artist name.
  await page.getByLabel(/Act name/).fill("Harbor Lights");
  await expect(card).toContainText("Harbor Lights");
  await page.getByRole("button", { name: /Use "Harbor Lights" as the artist name/ }).click();
  await expect(page.getByText("The Cover Maker and synced lyrics use this name.")).toBeVisible();

  // The dossier says it's written about the act.
  await expect(page.getByText(/written about Harbor Lights/)).toBeVisible();
  await page.getByRole("button", { name: /Build release dossier/ }).click();
  await expect(page.getByText("Test answer: for late-night drives.").first()).toBeVisible();

  // Saved with the song: still there after a reload.
  await page.waitForTimeout(1600); // autosave runs 1.2 s after the last change
  await openTool(page, "dossier");
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(page.getByTestId("artist-card")).toContainText("Harbor Lights", { timeout: 15000 });

  // The Cover Maker picked the name up.
  await clickMenu(page, "Cover Maker");
  await expect(page.getByLabel("Artist", { exact: true })).toHaveValue("Harbor Lights");
});

/** Starter steps tick themselves off as the tools are used. */
test("starter steps track progress and can be hidden", async ({ page }) => {
  await openTool(page, "quick");
  const steps = page.getByRole("region", { name: "Starter steps" });
  await expect(steps.getByTestId("starter-count")).toHaveText("0/5");

  // Quick song ticks step 1.
  await page.getByRole("button", { name: /moody synth-pop breakup song/ }).click();
  await page.getByRole("button", { name: /Make my song/ }).click();
  await expect(page.getByTestId("quick-style")).toBeVisible();
  await expect(steps.getByTestId("starter-count")).toHaveText("1/5");
  await expect(steps.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");

  // The list opens; a step's button goes to its tool.
  await steps.getByRole("button", { name: /Starter steps/ }).first().click();
  await expect(steps.getByText("Make a quick song (done)")).toBeAttached();
  await steps.getByRole("button", { name: "Open Bio & Pitch" }).click();
  await page.waitForFunction(() => document.body.dataset["tab"] === "dossier");
  await page.getByRole("button", { name: /Make my artist card/ }).click();
  await expect(page.getByTestId("artist-card")).toBeVisible();
  await expect(steps.getByTestId("starter-count")).toHaveText("2/5");

  // The Prompt Checker ticks its step in another page; the studio shows it on return.
  await page.goto("/tools/suno-prompt-checker?style=dark%20synthpop%2C%2092%20bpm%2C%20breathy%20alto");
  await expect(page.getByTestId("checker-score")).toHaveText(/\d+/);
  await page.waitForTimeout(1800);
  await openTool(page, "suno");
  await expect(page.getByRole("region", { name: "Starter steps" }).getByTestId("starter-count")).toHaveText("3/5");

  // Hiding it sticks.
  await page.getByRole("button", { name: "Hide starter steps" }).click();
  await expect(page.getByRole("region", { name: "Starter steps" })).toHaveCount(0);
  await openTool(page, "suno");
  await expect(page.getByRole("region", { name: "Starter steps" })).toHaveCount(0);
});
