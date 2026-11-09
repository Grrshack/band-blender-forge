import { CheckCircle2, ExternalLink, Puzzle, Send } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { EXTENSION_GUIDE_PATH, EXTENSION_STORE_URL } from "@/lib/brand";
import { versionAtLeast } from "@/lib/suno-payload";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type SunoPayload = {
  title: string;
  style: string;
  exclude: string;
  lyrics: string;
  artists?: string[];
  /** Extension 1.1+: Suno's advanced options; missing ones are left as Suno has them. */
  vocalGender?: "male" | "female" | undefined;
  weirdness?: number | undefined;
  styleInfluence?: number | undefined;
  /** true = turn Instrumental on, false = make sure it's off, missing = leave it. */
  instrumental?: boolean | undefined;
  /** Extension 1.1+: every alternate take, so the panel on Suno can switch between them. */
  takes?: Array<{ label: string; style: string; exclude: string }> | undefined;
  activeTake?: number | undefined;
};

/** True when the Band Blender browser extension is installed (it marks the page). */
export function hasSunoExtension(): boolean {
  return typeof document !== "undefined" && Boolean(document.documentElement.dataset["bbExtension"]);
}

/**
 * With the extension: hands the fields to it and opens Suno's Create page, where a small panel
 * fills the boxes on request. Without it: explains how to add it.
 */
/** The installed extension's version, read after the page has loaded (null = not detected). */
export function useExtensionVersion(): string | null {
  const [v, setV] = useState<string | null>(null);
  useEffect(() => {
    const read = () => setV(document.documentElement.dataset["bbExtension"] ?? null);
    read();
    // The extension marks the page as it loads; check again shortly in case it was a beat late.
    const t = setTimeout(read, 1500);
    return () => clearTimeout(t);
  }, []);
  return v;
}

const SUNO_CREATE = "https://suno.com/create";

/** Hands the song to extension 1.1+ and lets it open (or switch to) Suno; falls back to a new tab. */
export function openSunoViaExtension(payload: SunoPayload, waitMs = 1000) {
  let answered = false;
  const onAnswer = (e: MessageEvent) => {
    const d = e.data as { source?: string; type?: string; how?: string } | null;
    if (e.source !== window || d?.source !== "bb-extension" || d.type !== "suno-opened") return;
    answered = true;
    window.removeEventListener("message", onAnswer);
    if (d.how === "failed") window.open(SUNO_CREATE, "_blank", "noopener");
  };
  window.addEventListener("message", onAnswer);
  window.postMessage({ source: "band-blender", type: "send-to-suno", payload, openSuno: true }, window.location.origin);
  setTimeout(() => {
    if (answered) return;
    window.removeEventListener("message", onAnswer);
    window.open(SUNO_CREATE, "_blank", "noopener");
  }, waitMs);
}

export function SendToSuno({ payload, showStatus = false }: { payload: SunoPayload; showStatus?: boolean }) {
  const [help, setHelp] = useState(false);
  const [sent, setSent] = useState(false);
  const version = useExtensionVersion();

  const send = () => {
    if (!hasSunoExtension()) {
      setHelp(true);
      return;
    }
    const ext = document.documentElement.dataset["bbExtension"] ?? null;
    if (versionAtLeast(ext, "1.1.0")) {
      // 1.1+: the extension switches to a Suno Create tab you already have open, or opens one.
      // If it doesn't answer within a second, open Suno here instead.
      openSunoViaExtension(payload);
    } else {
      window.postMessage({ source: "band-blender", type: "send-to-suno", payload }, window.location.origin);
      // Opened here, inside the click, so pop-up blockers allow it.
      window.open("https://suno.com/create", "_blank", "noopener");
    }
    setSent(true);
    setTimeout(() => setSent(false), 4000);
  };

  return (
    <>
      <Button
        size="sm"
        onClick={send}
        className="glow-primary gap-1.5 text-xs"
        title={version ? `Send to Suno (extension ${version} connected)` : "Send to Suno"}
      >
        <Send className="size-3.5" /> {sent ? "Sent: press Fill in Suno" : "Send to Suno"}
      </Button>
      {showStatus ? (
        version ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-signal-high">
            <CheckCircle2 className="size-3.5" /> Extension connected
          </span>
        ) : (
          <button type="button" onClick={() => setHelp(true)} className="text-[11px] text-muted-foreground underline-offset-2 hover:underline">
            Extension not detected
          </button>
        )
      ) : null}
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Puzzle className="size-5 text-primary" /> Add the Send to Suno extension
            </DialogTitle>
            <DialogDescription>
              A free browser extension for Chrome, Edge or Brave on a computer. Press Send to Suno here, then Fill on
              Suno&apos;s Create page, and your title, style, exclude list and lyrics go straight in. You still press
              Create yourself.
            </DialogDescription>
          </DialogHeader>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>
              <a href={EXTENSION_STORE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline underline-offset-2">
                Add it from the Chrome Web Store <ExternalLink className="size-3.5" />
              </a>{" "}
              (one click; it works in Edge and Brave too).
            </li>
            <li>Reload this page, then press Send to Suno again.</li>
          </ol>
          <div className="rounded-lg border border-border bg-card/50 p-3 text-xs">
            <p className="font-medium text-foreground">Already added it?</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-muted-foreground">
              <li>Reload this page. The extension connects when a page loads, so tabs opened before you added it can&apos;t see it.</li>
              <li>
                Check it&apos;s switched on: open <span className="font-mono">chrome://extensions</span> in a new tab.
              </li>
              <li>In an Incognito or private window, extensions are off unless you allow them there.</li>
            </ul>
          </div>
          <p className="text-xs text-muted-foreground">
            It only fills text boxes when you press Fill: it never presses Create, never reads your songs or account, and
            sends nothing anywhere.{" "}
            <a href={EXTENSION_GUIDE_PATH} className="text-primary underline underline-offset-2">
              How it works
            </a>
          </p>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
              <a href="https://suno.com/create" target="_blank" rel="noopener noreferrer">
                Open Suno without it <ExternalLink className="size-3.5" />
              </a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** True when the installed extension can fill this engine's page (version 1.1 and later). */
export function extensionSupports(engine: string): boolean {
  if (typeof document === "undefined") return false;
  return (document.documentElement.dataset["bbEngines"] ?? "").split(",").includes(engine);
}

const ENGINE_PAGES: Record<string, { label: string; url: string }> = {
  gemini: { label: "Gemini", url: "https://gemini.google.com/app" },
  eleven: { label: "ElevenLabs", url: "https://elevenlabs.io/app/music" },
};

/**
 * Hands the prompt to the extension for Gemini or ElevenLabs, or (without it) copies the main
 * prompt and opens the app so the person can paste it.
 */
export function SendToEngine({
  engine,
  fields,
}: {
  engine: "gemini" | "eleven";
  fields: Array<{ label: string; value: string; main?: boolean }>;
}) {
  const [note, setNote] = useState<string | null>(null);
  const page = ENGINE_PAGES[engine]!;
  const main = fields.find((f) => f.main) ?? fields[0];

  const send = async () => {
    if (!main?.value.trim()) return;
    if (extensionSupports(engine)) {
      window.postMessage({ source: "band-blender", type: "send-to-engine", payload: { engine, fields } }, window.location.origin);
      window.open(page.url, "_blank", "noopener");
      setNote(`Sent: press Fill in ${page.label}`);
    } else {
      // Opened before the clipboard write finishes so pop-up blockers allow it.
      window.open(page.url, "_blank", "noopener");
      try {
        await navigator.clipboard.writeText(main.value);
        setNote(`Prompt copied: paste it into ${page.label}`);
      } catch {
        setNote("Couldn't copy: use the Copy button on the Prompt box");
      }
    }
    setTimeout(() => setNote(null), 5000);
  };

  return (
    <Button size="sm" onClick={() => void send()} disabled={!main?.value.trim()} className="glow-primary gap-1.5 text-xs">
      <Send className="size-3.5" /> {note ?? `Send to ${page.label}`}
    </Button>
  );
}
