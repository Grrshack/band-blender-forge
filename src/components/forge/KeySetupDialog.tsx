import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

import { useSettings } from "./settings";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { testApiKey } from "@/lib/forge.functions";
import { providerLabel } from "@/lib/provider";
import { cn } from "@/lib/utils";
import { track } from "@/lib/stats";

type Check =
  | { state: "idle" }
  | { state: "testing" }
  | { state: "ok"; label: string }
  | { state: "fail"; message: string };

const GOOGLE_KEY_URL = "https://aistudio.google.com/apikey";
const ANTHROPIC_KEY_URL = "https://console.anthropic.com/settings/keys";

/** Names the two models behind the speed switch for the key the person has. */
function modelNames(key: string): string {
  if (!key.trim()) return "";
  return providerLabel(key) === "Google Gemini"
    ? " (Gemini Flash vs Gemini Pro; Pro needs a Google key with billing turned on, free keys use Flash for everything)"
    : " (Claude Haiku vs Claude Sonnet)";
}

/**
 * Opens whenever someone uses an AI tool without a key (own-key mode), or from the
 * System panel. Walks them through getting a free Google key, tests it, and saves it.
 */
export function KeySetupDialog() {
  const {
    apiKey,
    setApiKey,
    remember,
    setRemember,
    keyDialogOpen,
    setKeyDialogOpen,
    builtIn,
    routing,
    setRouting,
  } = useSettings();
  const test = useServerFn(testApiKey);
  const [draft, setDraft] = useState(apiKey);
  const [reveal, setReveal] = useState(false);
  const [check, setCheck] = useState<Check>({ state: "idle" });

  useEffect(() => {
    if (keyDialogOpen) {
      setDraft(apiKey);
      setCheck({ state: "idle" });
    }
  }, [keyDialogOpen, apiKey]);

  const trimmed = draft.trim();

  const runTest = async () => {
    if (!trimmed) return;
    setCheck({ state: "testing" });
    try {
      const r = await test({ data: { apiKey: trimmed } });
      track("key_test", r.ok ? "ok" : "fail");
      if (r.ok) {
        setCheck({ state: "ok", label: providerLabel(trimmed) });
        setApiKey(trimmed);
      } else {
        setCheck({ state: "fail", message: r.message });
      }
    } catch (e) {
      setCheck({
        state: "fail",
        message: e instanceof Error ? e.message : "The key check failed.",
      });
    }
  };

  const save = () => {
    track("key_saved", providerLabel(trimmed) === "Google Gemini" ? "gemini" : "anthropic");
    setApiKey(trimmed);
    setKeyDialogOpen(false);
  };

  return (
    <Dialog open={keyDialogOpen} onOpenChange={setKeyDialogOpen}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <KeyRound className="size-5 text-primary" /> Add your AI key
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {builtIn
              ? "A key is optional here, but with your own key there's no hourly limit."
              : "The AI tools run on your own key, so your work goes straight to your AI provider and there's no limit from us. Browsing, guides, the export sheet and mastering presets work without one."}
          </DialogDescription>
        </DialogHeader>

        {/* Option 1: Google (free) */}
        <section className="rounded-xl border border-primary/40 bg-primary/5 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Free: Google Gemini key</h3>
            <span className="rounded-full border border-signal-high/40 px-2 py-0.5 text-[11px] text-signal-high">
              Recommended
            </span>
          </div>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-foreground/90">
            <li>
              Open{" "}
              <a
                href={GOOGLE_KEY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary underline underline-offset-2"
              >
                Google AI Studio <ExternalLink className="size-3" />
              </a>{" "}
              and sign in with any Google account.
            </li>
            <li>
              Click <span className="font-medium">Create API key</span>. If it asks for a project,
              let it create one for you.
            </li>
            <li>Copy the key and paste it below.</li>
          </ol>
        </section>

        {/* Option 2: Anthropic (paid) */}
        <p className="text-sm text-muted-foreground">
          Already pay for Claude? An{" "}
          <a
            href={ANTHROPIC_KEY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            Anthropic API key
          </a>{" "}
          works too (billed by Anthropic per use).
        </p>

        {/* Key input */}
        <div className="space-y-2">
          <label htmlFor="key-input" className="text-sm font-medium">
            Your key
          </label>
          <div className="flex gap-2">
            <Input
              id="key-input"
              type={reveal ? "text" : "password"}
              value={draft}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => {
                setDraft(e.target.value);
                setCheck({ state: "idle" });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && trimmed) void runTest();
              }}
              placeholder="Paste your Google or Anthropic key"
              className="font-mono text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={reveal ? "Hide key" : "Show key"}
              onClick={() => setReveal((v) => !v)}
              className="shrink-0"
            >
              {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </Button>
          </div>

          <div aria-live="polite" className="min-h-5 text-sm">
            {check.state === "testing" && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Checking the key…
              </span>
            )}
            {check.state === "ok" && (
              <span className="flex items-center gap-1.5 text-signal-high">
                <CheckCircle2 className="size-4" /> {check.label} key works. You're ready.
              </span>
            )}
            {check.state === "fail" && (
              <span className="flex items-start gap-1.5 text-destructive">
                <XCircle className="mt-0.5 size-4 shrink-0" /> {check.message}
              </span>
            )}
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-border p-3">
            <Switch checked={remember} onCheckedChange={setRemember} className="mt-0.5" />
            <span className="text-sm leading-snug">
              Remember on this device
              <span className="block text-xs text-muted-foreground">
                Off: the key is forgotten when you close this tab. On: it stays in this browser, so
                anyone using it could use your key.
              </span>
            </span>
          </label>
        </div>

        {/* Speed vs quality */}
        <div className="flex items-start gap-3 rounded-lg border border-border p-3">
          <Switch
            checked={routing === "craft"}
            onCheckedChange={(v) => setRouting(v ? "craft" : "fast")}
            className="mt-0.5"
          />
          <span className="text-sm leading-snug">
            Best quality for every tool
            <span className="block text-xs text-muted-foreground">
              {routing === "craft" ? "On" : "Off"}: blends, comparisons and release kits use the{" "}
              {routing === "craft" ? "stronger, slower" : "faster, lighter"} model
              {modelNames(trimmed || apiKey)}. Lyrics, critiques and fixes always use the stronger
              model.
            </span>
          </span>
        </div>

        {/* Privacy */}
        <div className="flex gap-2.5 rounded-lg border border-border bg-card/50 p-3 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-signal-high" />
          <div className="space-y-1.5">
            <p>
              <span className="text-foreground/90">Free Google keys:</span> Google may use your
              prompts and results to improve its products, and people at Google may review them.{" "}
              <span className="text-foreground/90">Paid keys</span> (Google with billing turned on,
              or Anthropic): your prompts aren't used to improve their products.
            </p>
            <p>
              We never save your key. It stays in your browser and passes through our server only to
              make each request. Google requires API users to be 18 or older.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          {apiKey && (
            <Button
              variant="ghost"
              onClick={() => {
                setApiKey("");
                setDraft("");
                setCheck({ state: "idle" });
              }}
              className="mr-auto text-muted-foreground"
            >
              Remove key
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => void runTest()}
            disabled={!trimmed || check.state === "testing"}
          >
            Test key
          </Button>
          <Button
            onClick={save}
            disabled={!trimmed}
            className={cn(check.state === "ok" && "glow-primary")}
          >
            Save key
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
