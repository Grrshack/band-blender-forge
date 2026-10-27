import { Check, Save } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { newTake, type Take } from "@/lib/takes";

const label = (t: Take, i: number) =>
  `Take ${i + 1} · ${"★".repeat(t.rating)}${t.note ? ` · ${t.note.slice(0, 40)}` : ""}`;

/**
 * Pins a check result to one of the song's takes, so the song page can show it later. With no
 * takes logged yet, it logs one from the current style prompt first.
 */
export function SaveToTake({
  takes,
  style,
  exclude,
  onSave,
  what,
}: {
  takes: Take[];
  style: string;
  exclude: string;
  /** Called with the (possibly new) take list and the take to attach the result to. */
  onSave: (takes: Take[], takeId: string) => void;
  what: string;
}) {
  const [choice, setChoice] = useState<string>(takes[takes.length - 1]?.id ?? "new");
  const [saved, setSaved] = useState(false);

  const save = () => {
    let list = takes;
    let id = choice;
    if (choice === "new" || !takes.some((t) => t.id === choice)) {
      const t = newTake(style || "(style not recorded)", exclude, 3, `Logged from ${what}`);
      list = [...takes, t];
      id = t.id;
    }
    onSave(list, id);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor={`take-${what}`} className="text-xs text-muted-foreground">
        Save to
      </label>
      <select
        id={`take-${what}`}
        value={choice}
        onChange={(e) => setChoice(e.target.value)}
        className="h-8 max-w-[260px] rounded-md border border-border bg-card px-2 text-xs"
      >
        {takes.map((t, i) => (
          <option key={t.id} value={t.id}>
            {label(t, i)}
          </option>
        ))}
        <option value="new">A new take</option>
      </select>
      <Button size="sm" variant="outline" onClick={save} className="h-8 gap-1.5 text-xs">
        {saved ? <Check className="size-3.5 text-signal-high" /> : <Save className="size-3.5" />}
        {saved ? "Saved to the song" : "Save result"}
      </Button>
    </div>
  );
}
