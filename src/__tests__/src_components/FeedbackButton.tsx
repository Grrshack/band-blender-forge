import { useRouterState } from "@tanstack/react-router";
import { MessageSquarePlus } from "lucide-react";
import { Suspense, lazy, useEffect, useState } from "react";

import { FEEDBACK_EVENT, type FeedbackPrefill } from "@/lib/feedback";

// The form (and the database library it uses) loads the first time someone opens it.
const FeedbackDialog = lazy(() => import("./FeedbackDialog"));

/**
 * A small "Send feedback" button on every page. Opens a short form; also opens pre-filled
 * when someone presses "Report this" on an error.
 */
export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [prefill, setPrefill] = useState<FeedbackPrefill & { at: number }>({ at: 0 });
  // On large screens the studio's side menu has its own "Send feedback", so the floating
  // button would only cover it there.
  const inStudio = useRouterState({ select: (st) => st.location.pathname.startsWith("/studio") });

  const show = (p: FeedbackPrefill = {}) => {
    setPrefill({ ...p, at: Date.now() });
    setLoaded(true);
    setOpen(true);
  };

  useEffect(() => {
    const onOpen = (e: Event) => show((e as CustomEvent<FeedbackPrefill>).detail ?? {});
    window.addEventListener(FEEDBACK_EVENT, onOpen);
    return () => window.removeEventListener(FEEDBACK_EVENT, onOpen);
  }, []);

  return (
    <>
      <button
        type="button"
        data-feedback-button=""
        aria-label="Send feedback about the app"
        onClick={() => show()}
        // Start loading the form as soon as the pointer gets close, so it opens instantly.
        onPointerEnter={() => void import("./FeedbackDialog")}
        className={`fixed bottom-3 left-3 z-40 flex size-10 items-center justify-center gap-1.5 rounded-full border border-border bg-card/95 text-xs font-medium text-foreground shadow-lg backdrop-blur transition-colors hover:border-primary sm:bottom-4 sm:left-4 sm:size-auto sm:px-3.5 sm:py-2 print:hidden${inStudio ? " lg:hidden" : ""}`}
      >
        <MessageSquarePlus className="size-4 text-primary" /> <span className="hidden sm:inline">Send feedback</span>
      </button>
      {loaded ? (
        <Suspense fallback={null}>
          <FeedbackDialog open={open} setOpen={setOpen} prefill={prefill} />
        </Suspense>
      ) : null}
    </>
  );
}
