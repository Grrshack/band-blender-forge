import { ArrowRight, Check, CircleSlash, Loader2, TriangleAlert, Wand2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  MASTERING_CAN,
  MASTERING_CANT,
  type VerdictItem,
  type VerdictKind,
} from "@/lib/audio/mastering-verdict";
import { cn } from "@/lib/utils";

const KIND: Record<VerdictKind, { label: string; tone: string; Icon: typeof Check }> = {
  fix: { label: "Mastering fixes this", tone: "border-signal-high/40 text-signal-high", Icon: Check },
  partly: { label: "Mastering only partly helps", tone: "border-signal-mid/40 text-signal-mid", Icon: TriangleAlert },
  elsewhere: { label: "Mastering can't fix this", tone: "border-destructive/40 text-destructive", Icon: CircleSlash },
  ok: { label: "Fine", tone: "border-border text-muted-foreground", Icon: Check },
};

/** Two columns of what mastering can and can't do. */
function CanCant() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg border border-signal-high/30 bg-signal-high/5 p-3">
        <p className="mb-2 text-sm font-semibold text-signal-high">Mastering can fix</p>
        <ul className="space-y-1.5">
          {MASTERING_CAN.map((c) => (
            <li key={c} className="flex gap-2 text-xs text-foreground/90">
              <Check className="mt-0.5 size-3.5 shrink-0 text-signal-high" /> {c}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
        <p className="mb-2 text-sm font-semibold text-destructive">Mastering can't fix</p>
        <ul className="space-y-1.5">
          {MASTERING_CANT.map((c) => (
            <li key={c.problem} className="flex gap-2 text-xs text-foreground/90">
              <CircleSlash className="mt-0.5 size-3.5 shrink-0 text-destructive" />
              <span>
                {c.problem}
                <span className="block text-muted-foreground">Instead: {c.instead}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * Sits at the top of the Mastering tab. Before a song is loaded it says plainly what
 * mastering can and can't do; after, it gives this song's verdict, item by item.
 */
export function MasteringScope({
  songName,
  verdict,
  measuring,
  onApplyPreset,
  onOpenFix,
}: {
  songName: string | null;
  verdict: VerdictItem[] | null;
  measuring: boolean;
  onApplyPreset: (name: string) => void;
  onOpenFix?: (() => void) | undefined;
}) {
  const [showScope, setShowScope] = useState(false);

  if (!songName) {
    return (
      <section className="panel-surface p-5">
        <h2 className="font-display text-lg font-semibold">What mastering can and can't fix</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Mastering polishes a finished song. It can't change what Suno generated. Load a song and
          you'll get a verdict for it before you spend time here. Making an album or EP? Use the same
          preset and loudness target on every track so they match.
        </p>
        <CanCant />
      </section>
    );
  }

  const cantCount = verdict?.filter((v) => v.kind === "elsewhere").length ?? 0;

  return (
    <section className="panel-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold">Verdict for {songName}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {measuring
              ? "Measuring the song in your browser…"
              : cantCount
                ? `${cantCount} thing${cantCount > 1 ? "s" : ""} here need${cantCount > 1 ? "" : "s"} a fix in Suno first. Mastering will polish the rest.`
                : "Measured in your browser. Buried vocals and artifacts don't show up in measurements, so trust your ears too."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowScope((v) => !v)}
          className="text-xs text-primary underline underline-offset-2"
        >
          {showScope ? "Hide" : "What mastering can and can't fix"}
        </button>
      </div>

      {measuring ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Listening…
        </p>
      ) : null}

      {verdict ? (
        <ul className="mt-4 grid gap-2 md:grid-cols-2">
          {verdict.map((v) => {
            const k = KIND[v.kind];
            return (
              <li key={v.title} className={cn("rounded-lg border bg-card/40 p-3", k.tone.split(" ")[0])}>
                <p className={cn("flex items-center gap-1.5 text-[11px] font-medium", k.tone.split(" ")[1])}>
                  <k.Icon className="size-3.5" /> {k.label}
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">{v.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{v.detail}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {v.preset ? (
                    <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => onApplyPreset(v.preset!)}>
                      <Wand2 className="size-3" /> Use "{v.preset}"
                    </Button>
                  ) : null}
                  {v.route === "fix" && onOpenFix ? (
                    <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={onOpenFix}>
                      Fix it in Suno <ArrowRight className="size-3" />
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {showScope ? (
        <div className="mt-4">
          <CanCant />
        </div>
      ) : null}
    </section>
  );
}
