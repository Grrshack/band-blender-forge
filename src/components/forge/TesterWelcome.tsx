import { MessageSquarePlus, PenLine, Radar, Sliders } from "lucide-react";
import { useEffect, useState } from "react";

import { useSettings } from "./settings";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TESTING_PHASE } from "@/lib/brand";
import { openFeedback } from "@/lib/feedback";
import { readHandoff } from "@/lib/handoff";

const SEEN_KEY = "bb.tester-welcome-seen";

const STEPS = [
  {
    icon: Sliders,
    tab: "blend",
    title: "Make a style prompt and try it in Suno",
    body: "Blend two or three artists you like, copy it into Suno, then come back and rate the take: Keeper or Not quite.",
  },
  {
    icon: PenLine,
    tab: "lyrics",
    title: "Write lyrics in Lyric Forge",
    body: "Try Rhyme: \"Barely rhymes\" and Voice: \"Raw\", then press Rhyme scheme to see how it reads.",
  },
  {
    icon: Radar,
    tab: "analyze",
    title: "Analyze or master a song",
    body: "Drop in a song you love for its tempo, key and sections, or master one of your own in Mastering.",
  },
] as const;

/**
 * One-time note for testers: three things to try and how to send feedback. Shown on the
 * first studio visit while TESTING_PHASE is on, or any time with ?welcome in the address.
 */
export function TesterWelcome({ onGoTab, skip }: { onGoTab: (tab: string) => void; skip?: boolean }) {
  const { apiKey, builtIn, openKeyDialog } = useSettings();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const forced = q.has("welcome");
      // Don't interrupt someone arriving with a job to do: text from the landing page, a remix
      // or a shared link. They'll see the note on their next visit.
      const arriving = !!readHandoff(window.location.search) || q.has("remix") || /share=/.test(window.location.hash);
      if (forced || (TESTING_PHASE && !skip && !arriving && !localStorage.getItem(SEEN_KEY))) setOpen(true);
    } catch {
      /* storage unavailable: don't show */
    }
  }, [skip]);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const go = (tab: string) => {
    close();
    onGoTab(tab);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Thanks for testing!</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            Band Blender is new, and your feedback decides what gets fixed and built next. Here are three things
            worth trying. Ten minutes is plenty.
          </DialogDescription>
        </DialogHeader>

        <ol className="space-y-2">
          {STEPS.map((s, i) => (
            <li key={s.tab}>
              <button
                type="button"
                onClick={() => go(s.tab)}
                className="flex w-full gap-3 rounded-lg border border-border bg-card/50 p-3 text-left transition-colors hover:border-primary/60"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <s.icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">
                    {i + 1}. {s.title}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{s.body}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>

        {!apiKey && !builtIn ? (
          <p className="rounded-lg border border-border p-3 text-xs leading-relaxed text-muted-foreground">
            The AI parts need a free Google key; it takes about 2 minutes.{" "}
            <button type="button" onClick={() => { close(); openKeyDialog(); }} className="text-primary underline underline-offset-2">
              Set it up now
            </button>
            . Mastering, Analyze a Song and the free tools work without one.
          </p>
        ) : null}

        <div className="flex items-start gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
          <MessageSquarePlus className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="text-sm leading-relaxed">
            Anything confusing, broken or missing? Press <span className="font-semibold">Send feedback</span> at the
            bottom left of any page. Short notes are perfect.
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => { close(); openFeedback({ kind: "idea" }); }}>
            Send feedback now
          </Button>
          <Button onClick={() => go("assistant")}>Let&apos;s go</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
