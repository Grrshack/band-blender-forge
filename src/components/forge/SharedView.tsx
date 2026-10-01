import { AudioLines, ShieldCheck } from "lucide-react";

import { CopyButton } from "./CopyButton";
import { ShareExport } from "./ShareExport";
import { Button } from "@/components/ui/button";
import { exportText, type SharePayload } from "@/lib/share";

function Block({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="rounded-lg border border-border bg-card/60 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] tracking-[0.2em] text-primary uppercase">
          {label}
        </span>
        <CopyButton value={value} size="icon" />
      </div>
      <pre
        className={
          "font-sans text-sm leading-relaxed break-words whitespace-pre-wrap " +
          (mono ? "font-mono text-accent" : "")
        }
      >
        {value}
      </pre>
    </div>
  );
}

/** Read-only page for a shared sheet. Nothing here is saved to any account. */
export function SharedView({ payload, onClose }: { payload: SharePayload; onClose: () => void }) {
  return (
    <div className="mx-auto min-h-screen max-w-3xl space-y-4 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="glow-primary flex size-10 items-center justify-center rounded-xl border border-primary/40 bg-primary/10">
            <AudioLines className="size-5 text-primary" />
          </span>
          <div>
            <h1 className="neon-text font-display text-xl font-bold">
              {payload.title || "Shared sheet"}
            </h1>
            <p className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
              Shared Suno sheet · read-only
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
          Open the app
        </Button>
      </div>

      <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-signal-high" />
        This page is built entirely from the link you opened. Nothing is loaded from or saved to an
        account.
      </p>

      <Block label="Style of music" value={payload.style} mono />
      <Block label="Exclude styles" value={payload.exclude} mono />
      <Block label="Vocal line" value={payload.vocal} />
      <Block label="Lyrics" value={payload.lyrics} />

      <div className="flex flex-wrap items-center gap-2">
        <CopyButton value={exportText(payload)} label="Copy everything" />
      </div>
      <ShareExport payload={payload} disabled={false} />
    </div>
  );
}
