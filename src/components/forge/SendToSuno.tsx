import { Download, ExternalLink, Puzzle, Send } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { EXTENSION_STORE_URL } from "@/lib/brand";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type SunoPayload = { title: string; style: string; exclude: string; lyrics: string; artists?: string[] };

/** True when the Band Blender browser extension is installed (it marks the page). */
export function hasSunoExtension(): boolean {
  return typeof document !== "undefined" && Boolean(document.documentElement.dataset["bbExtension"]);
}

/**
 * With the extension: hands the fields to it and opens Suno's Create page, where a small panel
 * fills the boxes on request. Without it: explains how to add it.
 */
export function SendToSuno({ payload }: { payload: SunoPayload }) {
  const [help, setHelp] = useState(false);
  const [sent, setSent] = useState(false);

  const send = () => {
    if (!hasSunoExtension()) {
      setHelp(true);
      return;
    }
    window.postMessage({ source: "band-blender", type: "send-to-suno", payload }, window.location.origin);
    // Opened here, inside the click, so pop-up blockers allow it.
    window.open("https://suno.com/create", "_blank", "noopener");
    setSent(true);
    setTimeout(() => setSent(false), 4000);
  };

  return (
    <>
      <Button size="sm" onClick={send} className="glow-primary gap-1.5 text-xs">
        <Send className="size-3.5" /> {sent ? "Sent: press Fill in Suno" : "Send to Suno"}
      </Button>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Puzzle className="size-5 text-primary" /> Add the Send to Suno extension
            </DialogTitle>
            <DialogDescription>
              A small browser extension for Chrome, Edge or Brave on a computer. Press Send to Suno here, then Fill on
              Suno&apos;s Create page, and your title, style, exclude list and lyrics go straight in. You still press
              Create yourself.
            </DialogDescription>
          </DialogHeader>
          {EXTENSION_STORE_URL ? (
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              <li>
                <a href={EXTENSION_STORE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline underline-offset-2">
                  Add it from the Chrome Web Store <ExternalLink className="size-3.5" />
                </a>{" "}
                (it works in Edge and Brave too).
              </li>
              <li>Reload this page and press Send to Suno again.</li>
            </ol>
          ) : (
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>
              Download it:{" "}
              <a href="/band-blender-extension.zip" download className="inline-flex items-center gap-1 text-primary underline underline-offset-2">
                band-blender-extension.zip <Download className="size-3.5" />
              </a>
              , then unzip it.
            </li>
            <li>
              Open <span className="font-mono text-xs">chrome://extensions</span> and turn on <span className="font-medium">Developer mode</span>{" "}
              (top right).
            </li>
            <li>
              Press <span className="font-medium">Load unpacked</span> and choose the unzipped folder.
            </li>
            <li>Reload this page and press Send to Suno again.</li>
          </ol>
          )}
          <p className="text-xs text-muted-foreground">
            It only fills text boxes when you press Fill: it never presses Create, never reads your songs or account, and
            sends nothing anywhere.{EXTENSION_STORE_URL ? null : " A one-click version from the Chrome Web Store is coming."}
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
