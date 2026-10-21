import { CheckCircle2, Loader2, MessageSquarePlus, Star } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  FEEDBACK_EVENT,
  FEEDBACK_KINDS,
  sendFeedback,
  type FeedbackKind,
  type FeedbackPrefill,
} from "@/lib/feedback";
import { cn } from "@/lib/utils";

const NAME_KEY = "bb.tester-name";

/**
 * A small "Feedback" button on every page. Opens a short form; also opens pre-filled when
 * someone presses "Report this" on an error.
 */
export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FeedbackKind>("idea");
  const [message, setMessage] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    try {
      setName(localStorage.getItem(NAME_KEY) ?? "");
    } catch {
      /* storage unavailable */
    }
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<FeedbackPrefill>).detail ?? {};
      setSent(false);
      setError(null);
      if (d.kind) setKind(d.kind);
      if (d.message) setMessage(d.message);
      setOpen(true);
    };
    window.addEventListener(FEEDBACK_EVENT, onOpen);
    return () => window.removeEventListener(FEEDBACK_EVENT, onOpen);
  }, []);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await sendFeedback({ kind, message, suggestion, rating, testerName: name });
      try {
        localStorage.setItem(NAME_KEY, name.trim());
      } catch {
        /* ignore */
      }
      setSent(true);
      setMessage("");
      setSuggestion("");
      setRating(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send it.");
    } finally {
      setBusy(false);
    }
  };

  const prompt = FEEDBACK_KINDS.find((k) => k.value === kind)?.prompt ?? "";

  return (
    <>
      <button
        type="button"
        data-feedback-button=""
        aria-label="Send feedback about the app"
        onClick={() => {
          setSent(false);
          setError(null);
          setOpen(true);
        }}
        className="fixed bottom-3 left-3 z-40 flex size-10 items-center justify-center gap-1.5 rounded-full border border-border bg-card/95 text-xs font-medium text-foreground shadow-lg backdrop-blur transition-colors hover:border-primary sm:bottom-4 sm:left-4 sm:size-auto sm:px-3.5 sm:py-2 print:hidden"
      >
        <MessageSquarePlus className="size-4 text-primary" /> <span className="hidden sm:inline">Send feedback</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Send feedback</DialogTitle>
            <DialogDescription>
              Goes straight to the person building this. The page you're on and your device type are included; your
              lyrics, songs and AI key are not.
            </DialogDescription>
          </DialogHeader>

          {sent ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="size-10 text-emerald-400" />
              <p className="font-medium">Thanks, that's been logged.</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setSent(false)}>
                  Send another
                </Button>
                <Button size="sm" onClick={() => setOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="radiogroup" aria-label="Type of feedback">
                {FEEDBACK_KINDS.map((k) => (
                  <button
                    key={k.value}
                    type="button"
                    role="radio"
                    aria-checked={kind === k.value}
                    onClick={() => setKind(k.value)}
                    className={cn(
                      "rounded-md border px-2 py-2 text-xs transition-colors",
                      kind === k.value ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground",
                    )}
                  >
                    {k.label}
                  </button>
                ))}
              </div>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium">{prompt}</span>
                <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} maxLength={2000} />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium">
                  How should it work instead? <span className="font-normal text-muted-foreground">(optional)</span>
                </span>
                <Textarea value={suggestion} onChange={(e) => setSuggestion(e.target.value)} rows={2} maxLength={2000} />
              </label>

              <div className="space-y-1.5">
                <span className="text-sm font-medium">
                  How useful is it so far? <span className="font-normal text-muted-foreground">(optional)</span>
                </span>
                <div className="flex gap-1" role="radiogroup" aria-label="Rating">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={rating === n}
                      aria-label={`${n} of 5`}
                      onClick={() => setRating(rating === n ? null : n)}
                      className="p-1"
                    >
                      <Star className={cn("size-5", rating && n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
                    </button>
                  ))}
                </div>
              </div>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium">
                  Your name <span className="font-normal text-muted-foreground">(optional, remembered on this device)</span>
                </span>
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="So I know who to follow up with" />
              </label>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              <Button onClick={() => void submit()} disabled={busy || message.trim().length < 3} className="w-full gap-2">
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                Send feedback
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
