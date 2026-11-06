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

test("Lyric Forge sections can be moved, added where you want, and duplicated", async ({ page }) => {
  await openTool(page, "lyrics");
  await page.getByRole("button", { name: /^Forge Lyrics/ }).click();
  const order = () =>
    page.locator("main [data-section] .font-mono.uppercase").filter({ hasText: /^\[/ }).allInnerTexts();
  await expect.poll(order).toEqual(["[INTRO]", "[VERSE 1]", "[CHORUS]", "[VERSE 2]", "[CHORUS]", "[OUTRO]"]);

  // Arrows
  await page.getByRole("button", { name: "Move [Outro] up" }).click();
  await expect.poll(order).toEqual(["[INTRO]", "[VERSE 1]", "[CHORUS]", "[VERSE 2]", "[OUTRO]", "[CHORUS]"]);

  // Drag the last Chorus onto the top half of Verse 2
  const cards = page.locator("main [data-section]");
  // A tall window so both sections are on screen: the test can't scroll mid-drag (people can).
  await page.setViewportSize({ width: 1280, height: 3200 });
  await cards.nth(5).locator("[draggable=true]").dragTo(cards.nth(3), { targetPosition: { x: 60, y: 8 } });
  await expect.poll(order).toEqual(["[INTRO]", "[VERSE 1]", "[CHORUS]", "[CHORUS]", "[VERSE 2]", "[OUTRO]"]);

  // Add a Guitar Solo after Verse 1, then a sung Bridge right after it
  await page.getByLabel("Where to add the section").selectOption({ label: "After Verse 1" });
  await page.getByRole("button", { name: "[Guitar Solo]" }).click();
  await page.getByRole("button", { name: "[Bridge]" }).click();
  await expect.poll(order).toEqual(["[INTRO]", "[VERSE 1]", "[GUITAR SOLO]", "[BRIDGE]", "[CHORUS]", "[CHORUS]", "[VERSE 2]", "[OUTRO]"]);
  // The new Bridge has lines to write, and the AI can write them
  const bridge = cards.nth(3);
  await bridge.getByRole("button", { name: /Write this section/ }).click();
  await expect(bridge.locator("input").nth(1)).not.toHaveValue("");

  // Duplicate the first Chorus
  await page.getByRole("button", { name: "Duplicate [Chorus]" }).first().click();
  await expect.poll(async () => (await order()).filter((t) => t === "[CHORUS]").length).toBe(3);
});

test("Send to Suno is on Lyric Forge too, and points to the Chrome Web Store when the extension isn't there", async ({ page }) => {
  await openTool(page, "lyrics");
  await page.getByRole("button", { name: /^Forge Lyrics/ }).click();
  await page.getByRole("button", { name: "Send to Suno" }).first().click();
  const link = page.getByRole("link", { name: /Add it from the Chrome Web Store/ });
  await expect(link).toHaveAttribute("href", /chromewebstore\.google\.com\/detail\/band-blender-send-to-suno/);
  await expect(page.getByText("Already added it?")).toBeVisible();
  await expect(page.getByText(/unzip/i)).toHaveCount(0);
});
