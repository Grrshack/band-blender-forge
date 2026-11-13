import { expect, test as base, type Page } from "@playwright/test";

/** A key in Google's format. The test server never sends it anywhere (BB_FAKE_AI=1). */
export const FAKE_KEY = "AIzaTestKeyForAutomaticTests000000000";

/** Every tool in the studio menu: its tab id and the menu label. */
export const TOOLS: Array<{ tab: string; label: string }> = [
  { tab: "song", label: "This Song" },
  { tab: "quick", label: "Quick song" },
  { tab: "assistant", label: "Start here" },
  { tab: "blend", label: "Band Blender" },
  { tab: "analyze", label: "Analyze a Song" },
  { tab: "lyrics", label: "Lyric Forge" },
  { tab: "suno", label: "Suno Sheet" },
  { tab: "lyriccheck", label: "Lyric Check" },
  { tab: "fix", label: "Fix a Track" },
  { tab: "feedback", label: "Lyric Feedback" },
  { tab: "songcompare", label: "Compare Songs" },
  { tab: "master", label: "Mastering" },
  { tab: "releasecheck", label: "Release Check" },
  { tab: "cover", label: "Cover Maker" },
  { tab: "album", label: "Album Planner" },
  { tab: "promo", label: "Promo Clips" },
  { tab: "dossier", label: "Bio & Pitch" },
  { tab: "genres", label: "Genre Guides" },
  { tab: "library", label: "Prompt Library" },
  { tab: "compare", label: "Similar Artists" },
];

/** Noise that isn't a bug in the app (dev-server chatter, blocked third-party calls in CI). */
const IGNORED = [
  /React DevTools/i,
  /\[vite\]/i,
  /Failed to load resource/i,
  /net::ERR_/i,
  /favicon/i,
  /supabase/i,
  /musicbrainz/i,
  /Download the React DevTools/i,
];

type Fixtures = { errors: string[]; seeded: void };

/**
 * Every test gets a fresh browser with the welcome screens already dismissed, the full menu
 * showing, and a (fake) AI key saved. Any crash or console error fails the test at the end.
 */
export const test = base.extend<Fixtures>({
  seeded: [
    async ({ page }, use) => {
      await page.addInitScript((key) => {
        try {
          if (sessionStorage.getItem("bb.e2e-seeded")) return;
          sessionStorage.setItem("bb.e2e-seeded", "1");
          localStorage.setItem("bb.tester-welcome-seen", "1");
          localStorage.setItem("blf.visited", "1");
          localStorage.setItem("blf.mode", "rack");
          localStorage.setItem("blf.key.remember", "1");
          localStorage.setItem("blf.anthropic.key", key);
        } catch {
          /* ignore */
        }
      }, FAKE_KEY);
      await use();
    },
    { auto: true },
  ],
  errors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(`Crash: ${e.message}`));
      page.on("console", (m) => {
        if (m.type() !== "error") return;
        const text = m.text();
        if (IGNORED.some((r) => r.test(text))) return;
        errors.push(`Console error: ${text.slice(0, 300)}`);
      });
      await use(errors);
      expect(errors, "the page logged errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Opens one tool by its tab id and waits for the page to settle. */
export async function openTool(page: Page, tab: string) {
  await page.goto(`/studio?tab=${tab}`);
  await page.waitForLoadState("networkidle");
  await expectToolShown(page);
}

/** A tool's heading, a spinner while it loads data, or (Prompt Library offline) its "not available" note. */
export async function expectToolShown(page: Page) {
  await expect(
    page
      .locator("main h2, main .animate-spin")
      .first()
      .or(page.getByText(/isn't available right now/).first()),
  ).toBeVisible();
}

/** Opens a tool from the side menu (desktop) the way a person would. */
export async function clickMenu(page: Page, label: string) {
  const menu = page.getByRole("navigation", { name: "Tools" });
  const item = menu.getByRole("button", { name: new RegExp(`^${escape(label)}`) }).first();
  if (!(await item.isVisible())) await menu.getByText(/More tools/).click();
  await item.click();
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\&]/g, "\\$&");

/** A short WAV (sine tones with a beat) generated on the fly, for the audio tools. */
export function testWav(seconds = 6, sampleRate = 22050): Buffer {
  const n = seconds * sampleRate;
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const beat = Math.exp(-((t % 0.5) * 18)); // a kick every half second (120 BPM)
    const v = 0.35 * Math.sin(2 * Math.PI * 220 * t) + 0.25 * beat * Math.sin(2 * Math.PI * 55 * t) + 0.1 * Math.sin(2 * Math.PI * 1760 * t);
    data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 32767))), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(sampleRate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}
