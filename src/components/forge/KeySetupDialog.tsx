import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  ClipboardPaste,
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
const ANTHROPIC_BILLING_URL = "https://console.anthropic.com/settings/billing";

type KeyKind = "free" | "paid" | "anthropic";

/** The three ways to turn the AI on, shown as a picker so people can see their options. */
const KEY_KINDS: Array<{ value: KeyKind; label: string; tag: string; blurb: string }> = [
  {
    value: "free",
    label: "Free Google key",
    tag: "Free · 2 min",
    blurb: "Best place to start. Uses Gemini Flash; lyrics get an extra editing pass to make up for it.",
  },
  {
    value: "paid",
    label: "Google with billing",
    tag: "Pay per use",
    blurb: "Same key, with billing turned on. Unlocks Gemini Pro for stronger lyrics, and Google doesn't use your prompts to improve its products.",
  },
  {
    value: "anthropic",
    label: "Anthropic (Claude)",
    tag: "Pay per use",
    blurb: "Claude writes the lyrics. Prepaid credits from Anthropic; a Claude chat subscription doesn't include this.",
  },
];

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold">{n}</span>
      <span className="flex-1">{children}</span>
    </li>
  );
}

function OpenLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
    >
      {children} <ExternalLink className="size-3.5" />
    </a>
  );
}

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
    bestLyrics,
    setBestLyrics,
  } = useSettings();
  const [kind, setKind] = useState<KeyKind>("free");
  const test = useServerFn(testApiKey);
  const [draft, setDraft] = useState(apiKey);
  const [reveal, setReveal] = useState(false);
  const [check, setCheck] = useState<Check>({ state: "idle" });

  useEffect(() => {
    if (keyDialogOpen) {
      setDraft(apiKey);
      setCheck({ state: "idle" });
      // Open on the kind of key they already have, if any.
      if (apiKey.trim()) setKind(providerLabel(apiKey) === "Google Gemini" ? "free" : "anthropic");
    }
  }, [keyDialogOpen, apiKey]);
  const isAnthropicKey = Boolean((draft.trim() || apiKey).trim()) && providerLabel(draft.trim() || apiKey) !== "Google Gemini";

  const trimmed = draft.trim();

  const runTest = async (value = trimmed) => {
    if (!value) return;
    setCheck({ state: "testing" });
    try {
      const r = await test({ data: { apiKey: value } });
      track("key_test", r.ok ? "ok" : "fail");
      if (r.ok) {
        setCheck({ state: "ok", label: providerLabel(value) });
        setApiKey(value);
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

  // Paste and check in one go: the slowest part on a phone is switching apps and pasting.
  const pasteAndTest = async (text?: string) => {
    let value = text;
    if (value === undefined) {
      try {
        value = await navigator.clipboard.readText();
      } catch {
        setCheck({ state: "fail", message: "Your browser blocked pasting. Long-press the box below and choose Paste." });
        return;
      }
    }
    value = value.trim();
    if (!value) return;
    setDraft(value);
    void runTest(value);
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
            <KeyRound className="size-5 text-primary" /> Turn on the AI tools
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {builtIn
              ? "A key is optional here, but with your own key there's no hourly limit."
              : "Free with a Google key, and it takes about 2 minutes. Your work goes straight to Google, with no limits from us."}
          </DialogDescription>
        </DialogHeader>

        {check.state === "ok" ? (
          <section className="flex flex-col items-center gap-3 rounded-xl border border-signal-high/50 bg-signal-high/10 p-5 text-center">
            <CheckCircle2 className="size-9 text-signal-high" />
            <p className="font-medium">{check.label} key works. You&apos;re ready.</p>
            <Button className="glow-primary" onClick={save}>
              Start using it
            </Button>
          </section>
        ) : (
          <section className="space-y-3">
            {/* Which key: free is the default, the paid options are one tap away with their own steps. */}
            <div role="radiogroup" aria-label="Which kind of key" className="grid gap-2 sm:grid-cols-3">
              {KEY_KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  role="radio"
                  aria-checked={kind === k.value}
                  onClick={() => setKind(k.value)}
                  className={cn(
                    "rounded-lg border p-2.5 text-left transition-colors",
                    kind === k.value ? "border-primary/60 bg-primary/10" : "border-border hover:border-primary/40",
                  )}
                >
                  <span className="block text-sm font-medium">{k.label}</span>
                  <span
                    className={cn(
                      "mt-1 inline-block rounded-full border px-1.5 text-[11px]",
                      k.value === "free" ? "border-signal-high/40 text-signal-high" : "border-border text-muted-foreground",
                    )}
                  >
                    {k.tag}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{KEY_KINDS.find((k) => k.value === kind)!.blurb}</p>

            <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
              {kind === "free" ? (
                <ol className="space-y-3 text-sm leading-relaxed text-foreground/90">
                  <Step n={1}>
                    <OpenLink href={GOOGLE_KEY_URL}>Open Google AI Studio</OpenLink>
                    <span className="mt-1 block text-xs text-muted-foreground">Sign in with any Google account. It opens in a new tab.</span>
                  </Step>
                  <Step n={2}>
                    Press <span className="font-medium">Create API key</span>. If it asks about a project, let it make one.
                    Then press <span className="font-medium">Copy</span>.
                  </Step>
                  <Step n={3}>
                    Come back here and press{" "}
                    <Button size="sm" variant="outline" onClick={() => void pasteAndTest()} className="mx-1 h-8 gap-1.5">
                    <ClipboardPaste className="size-3.5" /> Paste &amp; check
                  </Button>
                    <span className="mt-1 block text-xs text-muted-foreground">Or paste it into the box below.</span>
                  </Step>
                </ol>
              ) : kind === "paid" ? (
                <ol className="space-y-3 text-sm leading-relaxed text-foreground/90">
                  <Step n={1}>
                    Get a key exactly like the free one:{" "}
                    <OpenLink href={GOOGLE_KEY_URL}>Open Google AI Studio</OpenLink>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Already pasted a free key here? Keep it: billing is turned on for the same key.
                    </span>
                  </Step>
                  <Step n={2}>
                    On the API keys page, find your key&apos;s project and press{" "}
                    <span className="font-medium">Set up billing</span>. Add a card in Google Cloud. Google bills per use,
                    usually a few cents for a set of lyrics.
                  </Step>
                  <Step n={3}>
                    Paste the key here and press <Button size="sm" variant="outline" onClick={() => void pasteAndTest()} className="mx-1 h-8 gap-1.5">
                    <ClipboardPaste className="size-3.5" /> Paste &amp; check
                  </Button>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Gemini Pro switches on by itself. If billing isn&apos;t active yet, the app keeps using Flash and tells
                      you.
                    </span>
                  </Step>
                </ol>
              ) : (
                <ol className="space-y-3 text-sm leading-relaxed text-foreground/90">
                  <Step n={1}>
                    <OpenLink href={ANTHROPIC_BILLING_URL}>Open the Anthropic Console</OpenLink>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Sign up, then add credits under Billing. Credits are prepaid; you choose the amount.
                    </span>
                  </Step>
                  <Step n={2}>
                    Go to{" "}
                    <a href={ANTHROPIC_KEY_URL} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
                      API keys
                    </a>
                    , press <span className="font-medium">Create key</span>, and copy it. It starts with{" "}
                    <span className="font-mono text-xs">sk-ant-</span>.
                  </Step>
                  <Step n={3}>
                    Paste it here and press <Button size="sm" variant="outline" onClick={() => void pasteAndTest()} className="mx-1 h-8 gap-1.5">
                    <ClipboardPaste className="size-3.5" /> Paste &amp; check
                  </Button>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Lyrics use Claude Sonnet. Turn on &quot;Best lyrics&quot; under More options for Claude&apos;s top model.
                    </span>
                  </Step>
                </ol>
              )}
            </div>
          </section>
        )}

        {!builtIn && check.state !== "ok" ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground/90">Not ready for a key?</span> These work without one:{" "}
            <a href="/studio?tab=master" className="text-primary underline underline-offset-2">Mastering</a>,{" "}
            <a href="/tools/bpm-key-finder" className="text-primary underline underline-offset-2">BPM &amp; key finder</a>,{" "}
            <a href="/tools/lyric-checker" className="text-primary underline underline-offset-2">lyric checker</a>,{" "}
            <a href="/tools/suno-metatags" className="text-primary underline underline-offset-2">metatags</a>, the Export Sheet and the guides.
          </p>
        ) : null}

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
              onPaste={(e) => {
                const text = e.clipboardData.getData("text");
                if (text.trim()) {
                  e.preventDefault();
                  void pasteAndTest(text);
                }
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

        <details className="group rounded-lg border border-border">
          <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium">
            More options and privacy <span className="text-muted-foreground group-open:hidden">▸</span>
            <span className="hidden text-muted-foreground group-open:inline">▾</span>
          </summary>
          <div className="space-y-3 px-3 pb-3">
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

        {/* Best lyrics: Anthropic keys only, opt-in because it costs more. */}
        <div className={cn("flex items-start gap-3 rounded-lg border border-border p-3", !isAnthropicKey && "opacity-60")}>
          <Switch
            checked={bestLyrics && isAnthropicKey}
            onCheckedChange={setBestLyrics}
            disabled={!isAnthropicKey}
            className="mt-0.5"
          />
          <span className="text-sm leading-snug">
            Best lyrics (Claude Opus)
            <span className="block text-xs text-muted-foreground">
              {isAnthropicKey
                ? "Writes and rewrites lyrics with Claude's top model instead of Sonnet. About twice the cost per song (still a few cents). If Opus is busy, it falls back to Sonnet."
                : "Needs an Anthropic key. Google keys use Gemini Pro (with billing) or Flash plus an editing pass."}
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

          </div>
        </details>

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
            disabled={!trimmed || check.state === "testing" || check.state === "ok"}
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
