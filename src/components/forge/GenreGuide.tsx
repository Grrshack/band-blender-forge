/**
 * GenreGuide — static reference cards for common genres.
 * Each card is a cheat sheet: BPM, instrumentation, vocal approach,
 * a ready-to-paste Suno style template, exclude tags, and example blends.
 */
import { useState } from "react";
import { Clipboard, ChevronDown, ChevronUp } from "lucide-react";
import { Panel } from "./Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type GenreCard = {
  id: string;
  name: string;
  emoji: string;
  family: string;
  bpm: string;
  feel: string;
  instrumentation: string;
  vocals: string;
  styleTemplate: string;
  exclude: string;
  notes: string;
  exampleBlends: { artists: string[]; description: string }[];
};

const GENRE_CARDS: GenreCard[] = [
  {
    id: "hip-hop",
    name: "Hip-hop",
    emoji: "🎤",
    family: "Hip-hop & R&B",
    bpm: "85–100 BPM",
    feel: "swung 16ths, laid-back pocket",
    instrumentation: "sampled drums, vinyl crackle, bass guitar, Rhodes, chopped soul samples",
    vocals: "Dry close-miked rap delivery, minimal reverb, punchy doubles on hooks",
    styleTemplate: "hip-hop, boom bap, 90bpm, sampled drums, soul samples, vinyl warmth, bass-heavy, melodic hooks, confident delivery",
    exclude: "electronic synths, trap hi-hats, EDM drops, orchestral swell",
    notes: "Suno v6 handles classic boom bap well. Front-load 'hip-hop' in the style tag and specify BPM — the model tends to default to trap if you don't constrain it.",
    exampleBlends: [
      { artists: ["J Dilla", "Nas", "D'Angelo"], description: "Neo-soul hip-hop with live-feeling drums and jazzy chord stabs" },
      { artists: ["Kendrick Lamar", "Flying Lotus"], description: "West coast psychedelic hip-hop, complex arrangement" },
    ],
  },
  {
    id: "trap",
    name: "Trap",
    emoji: "🔊",
    family: "Hip-hop & R&B",
    bpm: "130–145 BPM (half-time feel at 65–72)",
    feel: "half-time groove, thunderous sub, hi-hat rolls",
    instrumentation: "808 sub bass, trap hi-hat rolls, snare on 3, dark synth pads, piano loops",
    vocals: "Auto-tuned melodic rap, heavily processed, layered ad-libs",
    styleTemplate: "trap, dark, 140bpm, 808 bass, hi-hat rolls, melodic rap, auto-tune, atmospheric synths, cinematic",
    exclude: "live drums, acoustic instruments, bright mix, folk guitar",
    notes: "Specify '808 bass' explicitly — Suno distinguishes it from regular bass. 'Dark' or 'atmospheric' steers away from generic pop trap.",
    exampleBlends: [
      { artists: ["Travis Scott", "James Blake"], description: "Psychedelic atmospheric trap with soul-influenced vocal processing" },
      { artists: ["Future", "Arca"], description: "Avant-garde trap with experimental sound design" },
    ],
  },
  {
    id: "rnb",
    name: "R&B / Neo-Soul",
    emoji: "🌙",
    family: "Hip-hop & R&B",
    bpm: "75–95 BPM",
    feel: "behind-the-beat, sensual groove",
    instrumentation: "Rhodes piano, warm bass, live-feel drums, guitar chops, lush string pads",
    vocals: "Warm melismatic singing, close-miked intimacy, layered harmonies on chorus",
    styleTemplate: "r&b, neo-soul, 85bpm, Rhodes piano, warm bass, lush harmonies, soulful vocals, intimate production",
    exclude: "trap hi-hats, distorted guitars, aggressive delivery, EDM drops",
    notes: "Add 'intimate' or 'close-miked' to pull the vocal treatment away from arena R&B. 'Neo-soul' as a tag shifts the production from polished pop toward rawer live-instrument feel.",
    exampleBlends: [
      { artists: ["Frank Ocean", "D'Angelo", "Sade"], description: "Understated cinematic R&B with jazz-influenced harmony" },
      { artists: ["SZA", "Jorja Smith"], description: "Contemporary alternative R&B, melancholic and minimalist" },
    ],
  },
  {
    id: "house",
    name: "House",
    emoji: "🏠",
    family: "Electronic",
    bpm: "120–130 BPM",
    feel: "four-on-the-floor, hypnotic forward motion",
    instrumentation: "four-on-the-floor kick, open hi-hat, bass line, piano chords, vocal chops",
    vocals: "Filtered vocal samples, soulful house diva, call-and-response phrasing",
    styleTemplate: "house music, 124bpm, four-on-the-floor, piano chords, soulful vocals, warm bass line, Chicago house, uplifting",
    exclude: "aggressive synths, trap percussion, distortion, lo-fi",
    notes: "Naming a specific sub-genre (Chicago house, deep house, afro house) sharpens results significantly. 'Warm' prevents Suno from going clinical and cold.",
    exampleBlends: [
      { artists: ["Larry Heard", "Honey Dijon"], description: "Deep soulful house with Chicago roots" },
      { artists: ["Fred Again", "Four Tet"], description: "Modern emotional house, sampled vocals, organic feel" },
    ],
  },
  {
    id: "synthwave",
    name: "Synthwave",
    emoji: "🌆",
    family: "Electronic",
    bpm: "100–120 BPM",
    feel: "driving 80s nostalgia, gated reverb snare",
    instrumentation: "analogue synth arpeggios, gated reverb drums, bass synth, lead synth melody, Juno pads",
    vocals: "Lush gated reverb on vocals, 80s production sheen, airy falsetto or dramatic tenor",
    styleTemplate: "synthwave, retro 80s, 110bpm, analogue synths, arpeggiated bass, gated reverb drums, cinematic, nostalgic",
    exclude: "modern trap, acoustic guitar, live drums, ambient texture",
    notes: "'Gated reverb drums' is essential for the authentic 80s sound — without it Suno tends to use modern drum samples. 'Analogue synths' steers away from digital brightness.",
    exampleBlends: [
      { artists: ["Carpenter Brut", "John Carpenter"], description: "Dark horror-inflected synthwave, tense and cinematic" },
      { artists: ["Kavinsky", "Chromatics"], description: "Nocturnal driving synthwave with dream-pop influences" },
    ],
  },
  {
    id: "ambient",
    name: "Ambient / Drone",
    emoji: "🌊",
    family: "Electronic",
    bpm: "60–80 BPM or beatless",
    feel: "slow evolving textures, no defined pulse",
    instrumentation: "long-decay synth pads, field recordings, reverb-drenched piano, soft sub tones",
    vocals: "Wordless breathy tones, heavily processed beyond recognition, optional",
    styleTemplate: "ambient, atmospheric, beatless, evolving pads, reverb piano, meditative, cinematic, slow, minimalist",
    exclude: "percussion, bass drop, lyrics, energetic, aggressive",
    notes: "'Beatless' is the most important tag for true ambient. Without it Suno adds a light kick. 'Evolving' signals textural movement rather than repetitive loops.",
    exampleBlends: [
      { artists: ["Brian Eno", "Stars of the Lid"], description: "Orchestral ambient with slow-building string textures" },
      { artists: ["William Basinski", "Grouper"], description: "Decaying lo-fi tape ambient with fragile intimacy" },
    ],
  },
  {
    id: "indie-rock",
    name: "Indie Rock",
    emoji: "🎸",
    family: "Rock & Metal",
    bpm: "110–140 BPM",
    feel: "driving energy, slightly loose live feel",
    instrumentation: "electric guitars, bass guitar, live drums, occasional keys or strings",
    vocals: "Clean indie vocals, light room reverb, earnest delivery, layered harmonies on chorus",
    styleTemplate: "indie rock, 125bpm, jangly guitars, live drums, bass guitar, anthemic chorus, reverb vocals, warm production",
    exclude: "electronic drums, auto-tune, trap elements, polished pop sheen",
    notes: "'Jangly guitars' specifies the Rickenbacker/Telecaster sound. 'Live drums' prevents programmed-sounding MIDI kits. 'Warm production' avoids the cold over-compressed modern rock sound.",
    exampleBlends: [
      { artists: ["The National", "Big Thief"], description: "Melancholic literary indie rock with intimate production" },
      { artists: ["Arcade Fire", "Radiohead"], description: "Expansive art rock with orchestral elements and emotional intensity" },
    ],
  },
  {
    id: "metal",
    name: "Metal",
    emoji: "🤘",
    family: "Rock & Metal",
    bpm: "120–200 BPM",
    feel: "aggressive, tight, palm-muted chug",
    instrumentation: "down-tuned electric guitars, double kick drums, distorted bass, sparse keys",
    vocals: "Aggressive screamed or growled vocals, clean melodic chorus optional",
    styleTemplate: "metal, heavy, 160bpm, distorted guitars, double kick drums, down-tuned, aggressive, dark, powerful",
    exclude: "clean guitars, soft production, pop hooks, electronic beats",
    notes: "Specifying the sub-genre dramatically changes results: 'melodic death metal', 'post-metal', 'doom metal' each read very differently. Without it Suno defaults to generic radio metal.",
    exampleBlends: [
      { artists: ["Gojira", "Mastodon"], description: "Progressive technical metal with environmental themes and odd time signatures" },
      { artists: ["Rammstein", "Nine Inch Nails"], description: "Industrial metal with electronic elements and cinematic production" },
    ],
  },
  {
    id: "folk",
    name: "Folk / Indie Folk",
    emoji: "🌿",
    family: "Folk & Country",
    bpm: "80–120 BPM",
    feel: "organic, breath-in-the-room intimacy",
    instrumentation: "acoustic guitar, fingerpicked or strummed, upright bass, light percussion, violin or mandolin optional",
    vocals: "Warm close-miked vocals, natural room sound, gentle harmonies",
    styleTemplate: "indie folk, acoustic guitar, fingerpicked, 95bpm, warm vocals, intimate, natural recording, gentle percussion",
    exclude: "electronic drums, synths, auto-tune, polished pop production",
    notes: "'Fingerpicked' vs 'strummed' makes a large tonal difference. 'Natural recording' or 'room sound' steers away from the over-produced compressed folk sound.",
    exampleBlends: [
      { artists: ["Bon Iver", "Fleet Foxes"], description: "Layered vocal harmony folk with lush orchestral touches" },
      { artists: ["Sufjan Stevens", "Adrianne Lenker"], description: "Intimate confessional folk with sparse elegant arrangements" },
    ],
  },
  {
    id: "cinematic",
    name: "Cinematic / Orchestral",
    emoji: "🎬",
    family: "World & Classical",
    bpm: "60–100 BPM",
    feel: "sweeping, tension and release, scene-setting",
    instrumentation: "full orchestra, strings, brass, timpani, choir, subtle percussion",
    vocals: "Wordless choir, operatic vocals optional, dramatic and soaring",
    styleTemplate: "cinematic orchestral, epic, 80bpm, full strings, brass, choir, tension and release, film score, sweeping",
    exclude: "electronic beats, synths, rap, guitar distortion",
    notes: "Adding a mood word (ominous, triumphant, melancholic, ethereal) before 'cinematic' focuses Suno strongly. 'Film score' as a tag pulls results away from generic classical toward modern composer style.",
    exampleBlends: [
      { artists: ["Hans Zimmer", "Johann Johannsson"], description: "Minimalist modern orchestral with electronic undertones" },
      { artists: ["Ennio Morricone", "Max Richter"], description: "Lyrical neo-classical with narrative emotional arc" },
    ],
  },
];

export function GenreGuide({ onApplyToBlend }: { onApplyToBlend?: (genre: string) => void }) {
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState("All");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const families = ["All", ...Array.from(new Set(GENRE_CARDS.map((c) => c.family)))];

  const filtered = GENRE_CARDS.filter((c) => {
    const matchFamily = family === "All" || c.family === family;
    const matchQuery =
      !query ||
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.family.toLowerCase().includes(query.toLowerCase());
    return matchFamily && matchQuery;
  });

  const copyTag = async (id: string, tag: string) => {
    await navigator.clipboard.writeText(tag);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="space-y-5">
      <Panel
        title="Genre Reference Cards"
        subtitle="Ready-to-use Suno style templates and production notes for common genres."
      >
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search genres…"
            className="h-8 w-48 border-border bg-card/60 text-xs"
          />
          <div className="flex flex-wrap gap-1">
            {families.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFamily(f)}
                className={cn(
                  "rounded-full border px-3 py-1 font-mono text-[10px] transition-colors",
                  family === f
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Cards grid */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {filtered.map((card) => (
            <div
              key={card.id}
              className="flex flex-col rounded-xl border border-border bg-card/50 overflow-hidden"
            >
              {/* Card header */}
              <button
                type="button"
                className="flex items-center justify-between gap-2 p-4 text-left hover:bg-muted/30 transition-colors"
                onClick={() => setExpanded(expanded === card.id ? null : card.id)}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{card.emoji}</span>
                    <span className="font-semibold text-sm text-foreground">{card.name}</span>
                    <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[9px] text-muted-foreground">
                      {card.bpm}
                    </span>
                  </div>
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{card.feel}</p>
                </div>
                {expanded === card.id ? (
                  <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                )}
              </button>

              {/* Style tag — always visible */}
              <div className="border-t border-border/50 bg-primary/5 px-4 py-2.5">
                <div className="mb-1 font-mono text-[9px] tracking-widest text-primary/70 uppercase">
                  Style template
                </div>
                <p className="font-mono text-[11px] leading-relaxed text-foreground/80">{card.styleTemplate}</p>
                <div className="mt-2 flex gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 gap-1 border-border px-2 text-[10px]"
                    onClick={() => void copyTag(card.id, card.styleTemplate)}
                  >
                    <Clipboard className="size-2.5" />
                    {copied === card.id ? "Copied!" : "Copy"}
                  </Button>
                  {onApplyToBlend && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 gap-1 border-primary/40 bg-primary/5 px-2 text-[10px] text-primary hover:bg-primary/15"
                      onClick={() => onApplyToBlend(card.name)}
                    >
                      Set as genre target →
                    </Button>
                  )}
                </div>
              </div>

              {/* Expanded detail */}
              {expanded === card.id && (
                <div className="border-t border-border/50 space-y-3 p-4 text-xs">
                  <Detail label="Instrumentation" value={card.instrumentation} />
                  <Detail label="Vocals" value={card.vocals} />
                  <Detail label="Exclude from Suno" value={card.exclude} mono />
                  <div className="rounded-md border border-border/50 bg-muted/20 p-2.5">
                    <div className="mb-1 font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
                      Suno note
                    </div>
                    <p className="text-[11px] leading-relaxed text-foreground/70">{card.notes}</p>
                  </div>
                  <div>
                    <div className="mb-2 font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
                      Example artist blends
                    </div>
                    {card.exampleBlends.map((b, i) => (
                      <div key={i} className="mb-2 last:mb-0">
                        <span className="font-medium text-foreground/90">{b.artists.join(" × ")}</span>
                        <p className="text-[11px] text-muted-foreground">{b.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="mb-0.5 font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
        {label}
      </div>
      <p className={cn("text-[11px] leading-relaxed text-foreground/80", mono && "font-mono")}>{value}</p>
    </div>
  );
}
