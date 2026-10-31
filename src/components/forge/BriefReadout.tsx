import { CopyButton } from "./CopyButton";
import { BRIEF_PARTS, type BriefParts } from "@/lib/prompt-craft";

/**
 * The Studio Brief shown part by part, so you can see what each sentence is doing. The copy
 * button copies one clean block (no labels), which is what Suno's Style box takes.
 */
export function BriefReadout({ parts, text }: { parts: BriefParts; text: string }) {
  return (
    <div className="glow-teal rounded-lg border border-accent/40 bg-card/70 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
          Style prompt · Studio brief
        </span>
        <CopyButton value={text} label="Copy for Suno" />
      </div>
      <dl className="divide-y divide-border/60">
        {BRIEF_PARTS.filter((b) => parts[b.key]).map((b) => (
          <div key={b.key} className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 py-2 first:pt-0 last:pb-0">
            <dt className="pt-0.5 font-mono text-[10px] tracking-[0.18em] text-primary uppercase" title={b.hint}>
              {b.label}
            </dt>
            <dd className="font-mono text-sm leading-relaxed text-accent">{parts[b.key]}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[11px] text-muted-foreground">
        The labels are for you. Copy for Suno gives one plain block, {text.length.toLocaleString()} of 1,000 characters.
      </p>
    </div>
  );
}
