import {
  AudioWaveform,
  BarChart2,
  BookMarked,
  Bot,
  Gauge,
  Map,
  Rocket,
  Search,
  Send,
  Sliders,
  Stethoscope,
  Wand2,
  type LucideIcon,
} from "lucide-react";

import { useSettings } from "./settings";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type TabDef = { value: string; label: string; icon: LucideIcon; hint: string };
type Group = { stage: string; tabs: TabDef[] };

/** Tabs grouped by where the person is in making a song. */
export const TAB_GROUPS: Group[] = [
  {
    stage: "Create",
    tabs: [
      {
        value: "assistant",
        label: "Start here",
        icon: Bot,
        hint: "Say what you're making or what went wrong, and get pointed to the right tool",
      },
      {
        value: "blend",
        label: "Band Blender",
        icon: Sliders,
        hint: "Blend up to 3 artists into one produceable style for Suno",
      },
      {
        value: "lyrics",
        label: "Lyric Forge",
        icon: Wand2,
        hint: "Hook-first lyrics with per-line control and section tags",
      },
      {
        value: "genres",
        label: "Genre Guides",
        icon: Map,
        hint: "Genre presets with ready-to-use style tags and BPM ranges",
      },
      {
        value: "compare",
        label: "Comparables",
        icon: Search,
        hint: "Find real artists that match your lyrics or style",
      },
    ],
  },
  {
    stage: "Generate",
    tabs: [
      {
        value: "suno",
        label: "Export Sheet",
        icon: Send,
        hint: "Copy your style and lyrics into Suno, Udio or ElevenLabs",
      },
    ],
  },
  {
    stage: "Fix",
    tabs: [
      {
        value: "fix",
        label: "Fix a Track",
        icon: Stethoscope,
        hint: "Find out why a generation sounds off and how to fix it",
      },
      {
        value: "feedback",
        label: "Honest Feedback",
        icon: Gauge,
        hint: "A blunt critique of your lyrics",
      },
      {
        value: "master",
        label: "Mastering",
        icon: AudioWaveform,
        hint: "EQ, loudness and finishing, in your browser",
      },
    ],
  },
  {
    stage: "Release",
    tabs: [
      {
        value: "dossier",
        label: "Release Kit",
        icon: Rocket,
        hint: "Cover art prompt, metadata, social copy and a release checklist",
      },
      {
        value: "library",
        label: "Prompt Library",
        icon: BookMarked,
        hint: "Your saved prompts and the community's",
      },
    ],
  },
];

/** Only meaningful when the site offers a built-in model, since that's what it counts. */
const USAGE_TAB: TabDef = {
  value: "usage",
  label: "Usage",
  icon: BarChart2,
  hint: "Your built-in model calls",
};

export const ALL_TAB_VALUES = [
  ...TAB_GROUPS.flatMap((g) => g.tabs.map((t) => t.value)),
  USAGE_TAB.value,
];

function useGroups(): Group[] {
  const { builtIn } = useSettings();
  if (!builtIn) return TAB_GROUPS;
  return TAB_GROUPS.map((g) =>
    g.stage === "Release" ? { ...g, tabs: [...g.tabs, USAGE_TAB] } : g,
  );
}

/** Desktop: grouped sidebar. */
export function RackSidebar({ tab, onTab }: { tab: string; onTab: (t: string) => void }) {
  const groups = useGroups();
  return (
    <nav
      aria-label="Tools"
      className="sticky top-4 hidden w-52 shrink-0 flex-col gap-3 self-start rounded-xl border border-border bg-panel/70 p-2 lg:flex"
    >
      {groups.map((g) => (
        <div key={g.stage}>
          <p className="px-3 pt-1 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground/80 uppercase">
            {g.stage}
          </p>
          <div className="flex flex-col gap-0.5">
            {g.tabs.map((t) => (
              <Tooltip key={t.value}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onTab(t.value)}
                    aria-current={tab === t.value ? "page" : undefined}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                      tab === t.value
                        ? "bg-primary/20 text-primary"
                        : "text-foreground/75 hover:bg-card/60 hover:text-foreground",
                    )}
                  >
                    <t.icon className="size-4 shrink-0" />
                    {t.label}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[240px] text-left">
                  {t.hint}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

/** Phone and tablet: one compact menu instead of a wall of buttons. */
export function RackMobileNav({ tab, onTab }: { tab: string; onTab: (t: string) => void }) {
  const groups = useGroups();
  const current = groups.flatMap((g) => g.tabs).find((t) => t.value === tab);
  const Icon = current?.icon ?? Sliders;
  return (
    <div className="mb-4 lg:hidden">
      <label htmlFor="tool-select" className="sr-only">
        Tool
      </label>
      <div className="relative flex items-center rounded-xl border border-border bg-panel/70">
        <Icon className="pointer-events-none absolute left-3 size-4 text-primary" />
        <select
          id="tool-select"
          value={tab}
          onChange={(e) => onTab(e.target.value)}
          className="w-full appearance-none rounded-xl bg-transparent py-3 pr-10 pl-10 text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {groups.map((g) => (
            <optgroup key={g.stage} label={g.stage}>
              {g.tabs.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <span aria-hidden className="pointer-events-none absolute right-3 text-muted-foreground">
          ▾
        </span>
      </div>
      {current && <p className="mt-1.5 px-1 text-xs text-muted-foreground">{current.hint}</p>}
    </div>
  );
}
