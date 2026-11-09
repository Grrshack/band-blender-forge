import { SlidersHorizontal } from "lucide-react";

import { FoldSummary } from "./Field";
import { useExtensionVersion } from "./SendToSuno";
import type { BlendSlice, SunoOptions } from "./types";
import { cn } from "@/lib/utils";

/** "1.0.0" < "1.1.0" */
import { versionAtLeast } from "@/lib/suno-payload";
export { versionAtLeast };

const GENDERS: Array<{ value: SunoOptions["vocalGender"]; label: string }> = [
  { value: undefined, label: "Let Suno choose" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

/**
 * Suno's advanced options that Send to Suno also fills (extension 1.1+): vocal gender,
 * Weirdness and Style Influence. Each one is optional; unset means Suno keeps its own.
 */
export function SunoOptionsCard({ blend, onBlend }: { blend: BlendSlice; onBlend: (next: BlendSlice) => void }) {
  const o = blend.sunoOptions ?? {};
  const version = useExtensionVersion();
  const set = (patch: Partial<SunoOptions>) => {
    const next: SunoOptions = { ...o, ...patch };
    for (const k of Object.keys(next) as Array<keyof SunoOptions>) if (next[k] === undefined) delete next[k];
    onBlend({ ...blend, sunoOptions: Object.keys(next).length ? next : undefined });
  };
  const summary = [
    o.vocalGender ? `${o.vocalGender === "male" ? "Male" : "Female"} vocal` : null,
    o.weirdness !== undefined ? `Weirdness ${o.weirdness}%` : null,
    o.styleInfluence !== undefined ? `Style Influence ${o.styleInfluence}%` : null,
  ].filter(Boolean);

  const slider = (key: "weirdness" | "styleInfluence", label: string, start: number, hint: string) => {
    const on = o[key] !== undefined;
    return (
      <div className="space-y-1">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={on}
            onChange={(e) => set({ [key]: e.target.checked ? start : undefined })}
            className="size-3.5 accent-[var(--primary)]"
          />
          <span className="font-medium">{label}</span>
          <span className="text-muted-foreground">{on ? `${o[key]}%` : "leave Suno's setting"}</span>
        </label>
        {on ? (
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={o[key]}
            onChange={(e) => set({ [key]: Number(e.target.value) })}
            aria-label={`${label} percent`}
            className="w-full accent-[var(--primary)]"
          />
        ) : null}
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
    );
  };

  return (
    <details className="group rounded-lg border border-border bg-card/40">
      <FoldSummary
        icon={<SlidersHorizontal className="size-4 shrink-0 text-primary" />}
        hint={summary.length ? summary.join(" · ") : "Vocal gender, Weirdness and Style Influence: set them here and Send to Suno fills them too"}
      >
        Suno&apos;s advanced options
      </FoldSummary>
      <div className="space-y-3 px-3 pb-3">
        <div className="space-y-1">
          <p className="text-xs font-medium">Vocal gender</p>
          <div role="radiogroup" aria-label="Vocal gender" className="inline-flex rounded-md border border-border p-0.5">
            {GENDERS.map((g) => (
              <button
                key={g.label}
                type="button"
                role="radio"
                aria-checked={o.vocalGender === g.value}
                onClick={() => set({ vocalGender: g.value })}
                className={cn(
                  "rounded px-2.5 py-1 text-xs transition-colors",
                  o.vocalGender === g.value ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
        {slider("weirdness", "Weirdness", 40, "Higher takes more risks. Around 30-45 keeps Suno close to your prompt.")}
        {slider("styleInfluence", "Style Influence", 85, "How strictly Suno follows your style. Around 85-90 for first takes.")}
        <button
          type="button"
          onClick={() => set({ weirdness: 40, styleInfluence: 85 })}
          className="text-xs text-primary underline-offset-2 hover:underline"
        >
          Use the &quot;Explore&quot; starting point (Weirdness 40, Style Influence 85)
        </button>
        <p className="text-[11px] text-muted-foreground">
          {version && !versionAtLeast(version, "1.1.0")
            ? `Your extension (${version}) fills the text boxes only; these need version 1.1, coming soon. Until then, set them in Suno's "More options" yourself.`
            : "Send to Suno fills these in Suno's \"More options\" when you press Fill. Copying by hand? Set them there yourself."}{" "}
          If the song has sections but no sung lines, Fill also switches on Instrumental.
        </p>
      </div>
    </details>
  );
}
