import type { Page } from "@playwright/test";
import { clickMenu, expect, openTool, test, testWav } from "./helpers";

/** Runs a quick blend (canned answer) so tools that need a style have one. */
async function makeBlend(page: Page) {
  await openTool(page, "blend");
  await page.getByPlaceholder("Primary artist").fill("Test Artist One");
  await page.getByRole("button", { name: /^Run Blend/ }).click();
  await expect(page.getByText(/dark synthpop, cinematic/).first()).toBeVisible();
}

test("Fix a Track diagnoses a take", async ({ page }) => {
  await openTool(page, "fix");
  await page.getByPlaceholder(/Paste the style prompt from Suno/).fill("dark synthpop, 92 bpm, breathy alto");
  await page.getByRole("button", { name: "Vocals buried or unclear" }).click();
  await page.getByRole("button", { name: /Diagnose & Revise/ }).click();
  await expect(page.getByText("Test answer: the vocal sits behind the synths.").first()).toBeVisible();
});

test("Lyric Feedback critiques lyrics", async ({ page }) => {
  await openTool(page, "feedback");
  await page.getByPlaceholder("Paste the full draft, section tags and all…").fill("Neon rain, wash it all away\nNeon rain, I am here to stay\nColors running down the glass\nNothing bright was built to last");
  await page.getByRole("button", { name: /Tear It Apart/ }).click();
  await expect(page.getByText(/Test answer: a clear hook/).first()).toBeVisible();
});

test("Release Check gives distributor answers once all four are answered", async ({ page }) => {
  await openTool(page, "releasecheck");
  const questions = page.locator('main [role="radiogroup"]');
  await expect(questions).toHaveCount(4);
  for (let i = 0; i < 4; i++) await questions.nth(i).getByRole("radio", { name: "AI-assisted" }).click();
  await expect(page.getByText("DistroKid AI credits").first()).toBeVisible();
  // Nothing to check yet shows as neutral, not as a green pass.
  await expect(page.getByText(/Nothing to check/).first()).toBeVisible();
  // Reasons open on tap.
  await page.getByRole("button", { name: "Why?" }).first().click();
  await expect(page.getByRole("button", { name: "Hide" }).first()).toBeVisible();
});

test("Mastering loads a song and gives a verdict", async ({ page }) => {
  await openTool(page, "master");
  await page.locator('main input[type="file"]').first().setInputFiles({ name: "test-song.wav", mimeType: "audio/wav", buffer: testWav() });
  await expect(page.getByText(/Verdict for test-song/).first()).toBeVisible({ timeout: 30_000 });
});

test("Analyze a Song measures a file and builds a prompt", async ({ page }) => {
  await openTool(page, "analyze");
  await page.locator('main input[type="file"]').first().setInputFiles({ name: "reference.wav", mimeType: "audio/wav", buffer: testWav(12) });
  await page.getByPlaceholder(/moody trip-hop/).fill("dark synthpop, breathy female vocal", { timeout: 45_000 });
  await page.getByRole("button", { name: /Build a Suno prompt in this style/ }).click();
  await expect(page.getByText(/dark synthpop, cinematic/).first()).toBeVisible();
});

test("Cover Maker downloads a cover", async ({ page }) => {
  await openTool(page, "cover");
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 30_000 }),
    page.getByRole("button", { name: /Download 3000×3000 JPG/ }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.jpe?g$/);
});

test("a take logged on the Suno Sheet shows up on This Song", async ({ page }) => {
  await makeBlend(page);
  await clickMenu(page, "Suno Sheet");
  await page.getByPlaceholder(/What was it like/).fill("Vocal a bit far back");
  await page.getByRole("button", { name: /Log this take/ }).click();
  await clickMenu(page, "This Song");
  await expect(page.getByRole("heading", { name: "Takes (1)" })).toBeVisible();
  await expect(page.getByText("Vocal a bit far back").first()).toBeVisible();
});

test("Bio & Pitch builds a release kit", async ({ page }) => {
  await makeBlend(page);
  await clickMenu(page, "Bio & Pitch");
  await page.getByRole("button", { name: /Build release dossier/ }).click();
  await expect(page.getByText("Test answer: for late-night drives.").first()).toBeVisible();
});

test("Release tools end with Download everything", async ({ page }) => {
  await openTool(page, "releasecheck");
  await expect(page.getByText("Download everything")).toBeVisible();
  await openTool(page, "dossier");
  await expect(page.getByText("Download everything")).toBeVisible();
});

test("the admin Lab stays closed to everyone else", async ({ page }) => {
  await openTool(page, "lab");
  await expect(page.getByText("Sign in with the admin account to use the Lab.")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Tools" }).getByRole("button", { name: /^Lab$/ })).toHaveCount(0);
});
