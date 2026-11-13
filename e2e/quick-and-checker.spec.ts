import { clickMenu, expect, openTool, test } from "./helpers";

/** The free Suno Prompt Checker: score, one-click fixes, undo, and handing the result to the studio. */
test("prompt checker scores an example, fixes it, and opens it on the Suno Sheet", async ({ page }) => {
  await page.goto("/tools/suno-prompt-checker");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Suno Prompt Checker" })).toBeVisible();
  await page.getByRole("button", { name: "Try an example" }).click();

  const score = page.getByTestId("checker-score");
  await expect(page.getByText("Fix the red ones first")).toBeVisible();
  const before = Number(await score.textContent());
  expect(before).toBeLessThan(60);

  await page.getByRole("button", { name: /Remove the names/ }).click();
  await expect(page.locator("#pc-style")).not.toHaveValue(/Weeknd/);
  await page.getByRole("button", { name: /Move them to Exclude/ }).click();
  await expect(page.locator("#pc-exclude")).toHaveValue(/autotune/);
  await page.getByRole("button", { name: /Remove them/ }).click();
  await expect(page.locator("#pc-style")).not.toHaveValue(/high quality|amazing/);
  await page.getByRole("button", { name: /Add a clean ending/ }).click();
  await expect(page.locator("#pc-lyrics")).toHaveValue(/\[End\]$/);
  const after = Number(await score.textContent());
  expect(after).toBeGreaterThan(before);

  // Undo puts the last fix back.
  await page.getByRole("button", { name: "Undo fix" }).click();
  await expect(page.locator("#pc-lyrics")).not.toHaveValue(/\[End\]$/);

  await page.getByRole("button", { name: /Open in the studio/ }).click();
  await page.waitForURL(/\/studio/);
  await expect(page.getByText("Your checked prompt is on the Suno Sheet as a new song.")).toBeVisible();
  await expect(page.locator("main").getByText(/synthwave/).first()).toBeAttached();
  await expect(page.locator("main").getByText("Neon lights in the city tonight").first()).toBeAttached();
  expect(new URL(page.url()).searchParams.get("import")).toBeNull();
});

/** Quick song: one box → intent, blend and lyrics → a Suno-ready card that carries into the studio. */
test("quick song makes a Suno-ready song and carries it into the studio", async ({ page }) => {
  await openTool(page, "quick");
  await expect(page.getByRole("heading", { name: "Quick song" })).toBeVisible();
  await page.getByRole("button", { name: /moody synth-pop breakup song/ }).click();
  await page.getByRole("radiogroup", { name: "Vocal" }).getByRole("radio", { name: "Female vocal" }).click();
  await page.getByRole("button", { name: /Make my song/ }).click();

  await expect(page.getByTestId("quick-style")).toContainText("dark synthpop");
  await expect(page.getByTestId("quick-lyrics")).toContainText("[Verse 1]");
  await expect(page.getByTestId("quick-lyrics")).toContainText("[End]");
  await expect(page.getByTestId("quick-title")).toHaveText("Neon Rain");
  await expect(page.getByRole("button", { name: /^Send to Suno/ })).toBeVisible();

  // It's a normal song now: Band Blender has the style, the Suno Sheet has Female set.
  await page.getByRole("button", { name: /Fine-tune the sound/ }).click();
  await expect(page.locator("main").getByText(/dark synthpop/).first()).toBeVisible();
  await clickMenu(page, "Suno Sheet");
  await page.getByText("Suno's advanced options").click();
  await expect(page.getByRole("radiogroup", { name: "Vocal gender" }).getByRole("radio", { name: "Female" })).toBeChecked();

  // Back on Quick song, the finished song shows instead of an empty box.
  await clickMenu(page, "Quick song");
  await expect(page.getByTestId("quick-title")).toHaveText("Neon Rain");
});

test("a first visit lands on Quick song; the landing page's Describe box starts one", async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("bb.e2e-first")) return;
    sessionStorage.setItem("bb.e2e-first", "1");
    localStorage.removeItem("blf.visited");
  });
  await page.goto("/studio");
  await expect(page.getByRole("heading", { name: "Quick song" })).toBeVisible();

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.locator("#l-desc").fill("Dark, heavy trip-hop about insomnia, whispered verses");
  await page.getByRole("button", { name: "Build my song" }).click();
  await expect(page.getByTestId("quick-style")).toContainText("dark synthpop");
  await expect(page.getByTestId("quick-lyrics")).toContainText("[Verse 1]");
});
