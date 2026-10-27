import {
  AudioWaveform,
  BarChart2,
  BookMarked,
  BookOpen,
  ClipboardCheck,
  Clapperboard,
  Disc3,
  Image,
  LayoutDashboard,
  ChevronDown,
  MessageSquarePlus,
  MicVocal,
  MoreHorizontal,
  Bot,
  Gauge,
  Map,
  Radar,
  Scale,
  Rocket,
  Search,
  Send,
  ShieldCheck,
  Sliders,
  Stethoscope,
  Wand2,
  type LucideIcon,
} from "lucide-react";

import { useAdminStatus } from "./auth";
import { useSettings } from "./settings";
import { openFeedback } from "@/lib/feedback";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type TabDef = { value: string; label: string; icon: LucideIcon; hint: string; badge?: string };
type Group = { stage: string; tabs: TabDef[] };

/** Tabs grouped by where the person is in making a song. */
export const TAB_GROUPS: Group[] = [
  {
    stage: "Song",
    tabs: [
      {
        value: "song",
        label: "This Song",
        icon: LayoutDashboard,
        hint: "How far along this song is, its takes and checks, and the next step",
      },
    ],
  },
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
        value: "analyze",
        label: "Analyze a Song",
        icon: Radar,
        hint: "Measure a song you love (tempo, key, sections) and get a Suno prompt in its style",
      },
      {
        value: "lyrics",
        label: "Lyric Forge",
        icon: Wand2,
        hint: "Hook-first lyrics with per-line control and section tags",
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
        hint: "Copy your style and lyrics into Suno (or ElevenLabs Music)",
      },
    ],
  },
  {
    stage: "Fix",
    tabs: [
      {
        value: "lyriccheck",
        label: "Lyric Check",
        icon: MicVocal,
        hint: "Did Suno sing your lyrics? Finds skipped and changed lines, with times",
        badge: "new",
      },
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
        value: "songcompare",
        label: "Compare Songs",
        icon: Scale,
        hint: "Put your song next to one you love: see what's different and what to change",
        badge: "v1",
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
        value: "releasecheck",
        label: "Release Check",
        icon: ClipboardCheck,
        hint: "Before you upload: AI disclosure answers, rules that get songs pulled, and what's left to do",
      },
      {
        value: "cover",
        label: "Cover Maker",
        icon: Image,
        hint: "A 3000×3000 cover with your title on it, and prompts for art that doesn't look like AI",
      },
      {
        value: "album",
        label: "Album Planner",
        icon: Disc3,
        hint: "Plan an EP or album: track order, one shared sound, running time",
      },
      {
        value: "promo",
        label: "Promo Clips",
        icon: Clapperboard,
        hint: "Find the best 15 or 30 seconds and make a vertical lyric clip",
      },
      {
        value: "dossier",
        label: "Release Kit",
        icon: Rocket,
        hint: "Title ideas, metadata, social copy and a playlist pitch",
      },
    ],
  },
  {
    // Less-used tools, folded away so the main path (Create → Generate → Fix → Release) stands out.
    stage: "More",
    tabs: [
      {
        value: "genres",
        label: "Genre Guides",
        icon: Map,
        hint: "Genre presets with ready-to-use style tags and BPM ranges",
      },
      {
        value: "library",
        label: "Prompt Library",
        icon: BookMarked,
        hint: "Your saved prompts and the community's",
      },
      {
        value: "compare",
        label: "Comparables",
        icon: Search,
        hint: "Find real artists that match your lyrics or style",
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
  return TAB_GROUPS.map((g) => (g.stage === "More" ? { ...g, tabs: [...g.tabs, USAGE_TAB] } : g));
}

/** Shown only to admins: a link to the dashboard with the count of new feedback. */
function AdminLink({ compact = false }: { compact?: boolean }) {
  const { isAdmin, newFeedback } = useAdminStatus();
  if (!isAdmin) return null;
  const badge = newFeedback ? (
    <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
      {newFeedback} new
    </span>
  ) : null;
  return compact ? (
    <a href="/admin" className="flex items-center gap-1 text-xs text-primary underline underline-offset-2">
      <ShieldCheck className="size-3.5" /> Admin {badge}
    </a>
  ) : (
    <a
      href="/admin"
      className="flex items-center gap-2.5 rounded-lg border border-primary/40 px-3 py-2 text-sm text-primary hover:bg-primary/10"
    >
      <ShieldCheck className="size-4 shrink-0" />
      <span className="flex-1">Admin</span>
      {badge}
    </a>
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
      {groups.map((g) => {
        const more = g.stage === "More";
        const holdsCurrent = g.tabs.some((t) => t.value === tab);
        const list = (
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
                    <span className="flex-1">{t.label}</span>
                    {t.badge ? (
                      <span className="rounded border border-primary/40 px-1 font-mono text-[11px] leading-4 text-primary">
                        {t.badge}
                      </span>
                    ) : null}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[240px] text-left">
                  {t.hint}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        );
        return more ? (
          <details key={g.stage} open={holdsCurrent || undefined} className="group">
            {/* Looks like a menu item, not a small label, so it isn't missed. */}
            <summary className="flex w-full cursor-pointer list-none items-center gap-2.5 rounded-lg border border-border px-3 py-2 text-sm text-foreground/80 transition-colors hover:border-primary/50 hover:text-foreground [&::-webkit-details-marker]:hidden">
              <MoreHorizontal className="size-4 shrink-0" />
              <span className="flex-1">
                More tools <span className="text-xs text-muted-foreground">({g.tabs.length})</span>
              </span>
              {/* A big, filled arrow button so it's obvious this opens. */}
              <span
                aria-hidden
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary transition-colors group-hover:bg-primary/30"
              >
                <ChevronDown className="size-5 transition-transform group-open:rotate-180" strokeWidth={2.5} />
              </span>
            </summary>
            <div className="mt-1">{list}</div>
          </details>
        ) : (
          <div key={g.stage}>
            <p className="px-3 pt-1 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground/80 uppercase">
              {g.stage}
            </p>
            {list}
          </div>
        );
      })}
      <div className="mt-1 flex flex-col gap-0.5 border-t border-border pt-2">
        <a
          href="/guides"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground/75 hover:bg-card/60 hover:text-foreground"
        >
          <BookOpen className="size-4 shrink-0" /> Guides
        </a>
        <button
          type="button"
          onClick={() => openFeedback()}
          className="flex items-center gap-2.5 rounded-lg bg-primary/10 px-3 py-2 text-left text-sm text-primary hover:bg-primary/20"
        >
          <MessageSquarePlus className="size-4 shrink-0" /> Send feedback
        </button>
        <AdminLink />
      </div>
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
            <optgroup key={g.stage} label={g.stage === "More" ? "More tools" : g.stage}>
              {g.tabs.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.badge ? `${t.label} (${t.badge})` : t.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <span aria-hidden className="pointer-events-none absolute right-3 text-muted-foreground">
          ▾
        </span>
      </div>
      <div className="mt-1.5 flex items-start justify-between gap-3 px-1">
        {current ? <p className="text-xs text-muted-foreground">{current.hint}</p> : <span />}
        <span className="flex shrink-0 items-center gap-3">
          <a href="/guides" className="text-xs text-primary underline underline-offset-2">
            Guides
          </a>
          <button
            type="button"
            onClick={() => openFeedback()}
            className="flex items-center gap-1 text-xs text-primary underline underline-offset-2"
          >
            <MessageSquarePlus className="size-3.5" /> Feedback
          </button>
          <AdminLink compact />
        </span>
      </div>
    </div>
  );
}
