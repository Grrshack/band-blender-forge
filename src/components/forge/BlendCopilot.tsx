import { Bot, X } from "lucide-react";

import { StudioAssistant, type IntentResponse } from "./StudioAssistant";
import type { BlendSlice } from "./types";
import { cn } from "@/lib/utils";

/**
 * Non-modal assistant drawer inside Band Blender. No overlay, so the sliders and
 * artist fields stay visible and you can watch them move as the AI sets them.
 */
export function BlendCopilot({
  open,
  onOpenChange,
  currentBlend,
  onApply,
  autoRun,
  onToggleAutoRun,
  onGoTab,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentBlend: BlendSlice;
  onApply: (intent: IntentResponse) => void;
  autoRun: boolean;
  onToggleAutoRun: (v: boolean) => void;
  onGoTab: (tab: string) => void;
}) {
  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          className="glow-primary fixed right-5 bottom-5 z-40 flex items-center gap-2 rounded-full border border-primary/50 bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg transition-transform hover:scale-105"
        >
          <Bot className="size-4" />
          AI Assistant
        </button>
      )}
      <aside
        aria-label="Blend assistant"
        aria-hidden={!open}
        className={cn(
          "panel-surface fixed top-0 right-0 z-50 flex h-full w-full max-w-[380px] flex-col border-l border-border p-4 shadow-2xl transition-transform duration-300",
          open ? "translate-x-0" : "pointer-events-none translate-x-full",
        )}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md border border-primary/40 bg-primary/10">
              <Bot className="size-4 text-primary" />
            </span>
            <div>
              <h2 className="font-display text-sm font-semibold">Blend assistant</h2>
              <p className="text-[11px] text-muted-foreground">Watch the controls move as it sets them.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close assistant"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        {(
          <StudioAssistant
            compact
            currentBlend={currentBlend}
            onApply={onApply}
            autoRun={autoRun}
            onToggleAutoRun={onToggleAutoRun}
            onGoTab={onGoTab}
            onFixSong={() => onGoTab("fix")}
          />
        )}
      </aside>
    </>
  );
}
