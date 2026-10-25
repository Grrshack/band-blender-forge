import { CheckCircle2, Loader2, ShieldCheck, Star } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FEEDBACK_KINDS, checkFeedbackAdmin, sendFeedback, type FeedbackKind, type FeedbackPrefill } from "@/lib/feedback";
import { cn } from "@/lib/utils";

const NAME_KEY = "bb.tester-name";

/**
 * The feedback form. Loaded only when someone opens it (see FeedbackButton), so its code and
 * the database library don't slow down every page's first load.
 */
export default function FeedbackDialog({
  open,
  setOpen,
  prefill,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  /** Changes each time the form is opened; may carry a type and message (e.g. from an error). */
  prefill: FeedbackPrefill & { at: number };
}) {
  const [kind, setKind] = useState<FeedbackKind>(prefill.kind ?? "idea");
  const [message, setMessage] = useState(prefill.message ?? "");
  const [suggestion, setSuggestion] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [admin, setAdmin] = useState<{ admin: boolean; newCount: number }>({ admin: false, newCount: 0 });

  // Admins get a shortcut to the log right here, since this is where they look for feedback.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void checkFeedbackAdmin().then((r) => {
      if (!cancelled) setAdmin(r);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    try {
      setName(localStorage.getItem(NAME_KEY) ?? "");
    } catch {
      /* storage unavailable */
    }
  }, []);

  // Each opening starts fresh, taking any pre-filled type and message.
  useEffect(() => {
    setSent(false);
    setError(null);
    if (prefill.kind) setKind(prefill.kind);
    if (prefill.message) setMessage(prefill.message);
  }, [prefill]);

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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Send feedback</DialogTitle>
            <DialogDescription>
              Goes straight to the person building this. The page you're on and your device type are included; your
              lyrics, songs and AI key are not.
            </DialogDescription>
          </DialogHeader>

          {admin.admin ? (
            <a
              href="/admin"
              className="flex items-center gap-2.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2.5 text-sm text-primary hover:bg-primary/20"
            >
              <ShieldCheck className="size-4 shrink-0" />
              <span className="flex-1 font-medium">You&apos;re an admin: view all feedback and usage</span>
              {admin.newCount ? (
                <span className="rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground">
                  {admin.newCount} new
                </span>
              ) : null}
              <span aria-hidden>→</span>
            </a>
          ) : null}

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
