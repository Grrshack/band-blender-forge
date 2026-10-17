import { KeyRound } from "lucide-react";

import { useSettings } from "./settings";
import { providerLabel } from "@/lib/provider";
import { cn } from "@/lib/utils";

/**
 * Header button showing whether AI tools are ready. Replaces the old floating
 * System & Credentials bar, which covered page content. Opens the key setup card.
 */
export function AiStatusButton({ className }: { className?: string | undefined }) {
  const { apiKey, builtIn, openKeyDialog } = useSettings();
  const hasKey = apiKey.trim().length > 0;

  const label = hasKey ? `${providerLabel(apiKey)} key` : builtIn ? "Built-in AI" : "Add AI key";

  return (
    <button
      type="button"
      onClick={openKeyDialog}
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors",
        hasKey || builtIn
          ? "border-border bg-panel/70 text-foreground/90 hover:border-primary/50"
          : "border-primary/60 bg-primary/15 text-primary hover:bg-primary/25",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-2 rounded-full",
          hasKey || builtIn ? "bg-signal-high" : "animate-pulse bg-primary",
        )}
      />
      <KeyRound className="size-3.5" />
      {label}
    </button>
  );
}
