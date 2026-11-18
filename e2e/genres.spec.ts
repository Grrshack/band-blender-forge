import { expect, test } from "./helpers";

/** Genre pages: the index, a page's prompt, and the three ways out (checker, studio, Quick song). */
test("genre index lists genres and uses and opens a page", async ({ page }) => {
  await page.goto("/genres");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { level: 1, name: "Suno prompts by genre" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Music for a purpose" }).getByRole("link")).toHaveCount(11);
  await page.getByRole("region", { name: "Genres" }).getByRole("link", { name: /Jazz/ }).click();
  await page.waitForURL(/\/genres\/jazz$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Suno prompts: style, tempo and vocals");
  await expect(page).toHaveTitle(/Jazz.*Suno prompts/);
});

test("a genre page's prompt opens in the checker and on the Suno Sheet", async ({ page }) => {
  await page.goto("/genres/hip-hop");
  await page.waitForLoadState("networkidle");
  const starter = page.getByRole("region", { name: "Starter prompt" });
  await expect(starter.getByText(/Checker score \d+/)).toBeVisible();
  const style = (await starter.locator("p.font-mono").first().textContent())!.trim();
  expect(style.length).toBeGreaterThan(20);

  // Check and fix it → the checker opens with the prompt filled in and scored.
  await starter.getByRole("link", { name: /Check and fix it/ }).click();
  await page.waitForURL(/suno-prompt-checker\?style=/);
  await expect(page.locator("#pc-style")).toHaveValue(style, { timeout: 15000 });
  await expect(page.getByTestId("checker-score")).toHaveText(/\d+/);

  // Back to the page; Open in the studio → the Suno Sheet with the prompt as a new song.
  await page.goBack();
  await page.waitForLoadState("networkidle");
  await page.getByRole("region", { name: "Starter prompt" }).getByRole("button", { name: /Open in the studio/ }).click();
  await page.waitForURL(/\/studio/);
  await expect(page.getByText("Your checked prompt is on the Suno Sheet as a new song.")).toBeVisible({ timeout: 20000 });
  await expect(page.locator("main").getByText(style.slice(0, 20)).first()).toBeAttached();
});

test("a genre page hands off to Quick song", async ({ page }) => {
  await page.goto("/genres/lofi-study");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("region", { name: "More prompts" })).toBeVisible();
  await page.getByRole("link", { name: /Make my song/ }).click();
  await page.waitForURL(/\/studio/);
  await expect(page.getByRole("heading", { name: "Quick song" })).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId("quick-style")).toBeVisible({ timeout: 20000 });
});

test("an unknown genre shows a way back", async ({ page }) => {
  await page.goto("/genres/not-a-genre");
  await expect(page.getByText("We don't have a page for that genre yet.")).toBeVisible();
  await expect(page.getByRole("link", { name: "All genres" })).toBeVisible();
});
