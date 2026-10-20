import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";

import landingCss from "../styles/landing.css?url";
import { APP_NAME } from "@/lib/brand";
import { GUIDES } from "@/lib/guides";
import { buildStudioHref, legacyStudioRedirect, type HandoffInput } from "@/lib/handoff";
import { SUNO_VERSION_LABELS, type SunoVersion } from "@/lib/suno";

const DESCRIPTION =
  "Describe the sound and get a Suno v6 style prompt that's checked for problems before you generate. Then write lyrics, fix a take and master in your browser. Free on your own AI key.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${APP_NAME} — Better Suno prompts, fewer wasted downloads` },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: `${APP_NAME} — Better Suno prompts` },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "stylesheet", href: landingCss }],
  }),
  component: Landing,
});

type Mode = "describe" | "artists" | "song";

const CHIPS = ["Dark cinematic trap", "90s grunge revival", "Lo-fi jazz hip-hop"];
const MODELS: SunoVersion[] = ["mini", "v6", "wild"];
const EXAMPLE_STYLE =
  "alternative grunge, dreamy synthwave chorus, 96 bpm, fuzzed guitars, analog poly pads, breathy female vocal, tape saturation, bittersweet";

const JUMPS = [
  { tab: "fix", title: "Fix a song Suno made", body: "Get the exact edit to paste into Suno. No download needed." },
  { tab: "lyrics", title: "Write lyrics", body: "Hook-first, with pronunciation and line-length checks." },
  { tab: "master", title: "Master a song or stem", body: "A verdict on what mastering can fix. Runs in your browser." },
  { tab: "assistant", title: "Start from a beat", body: "Make one free, find its tempo, bring it into Suno." },
];

const FAQ = [
  ["Is it free?", "Yes. The AI tools run on your own Google or Anthropic key. A free Google key works."],
  ["Does it make the music?", "No. Suno does. This helps you get a better result from it and finish the song."],
  ["Do I need an account?", "Only to save songs. Everything else works without one."],
  ["Which Suno versions?", "v6-mini, v6 and v6-wild."],
  ["Is this made by Suno?", "No. It's an independent tool and isn't affiliated with Suno."],
];

function Landing() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("describe");
  const [text, setText] = useState("");
  const [artists, setArtists] = useState(["", "", ""]);
  const [song, setSong] = useState("");
  const [sliders, setSliders] = useState({ energy: 70, complexity: 50, brightness: 55 });
  const [model, setModel] = useState<SunoVersion>("mini");
  const [hint, setHint] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Old links to "/" (?tab=, ?remix=, #share=, sign-up returns) belong to the studio.
  useEffect(() => {
    const to = legacyStudioRedirect(window.location.search, window.location.hash);
    if (to) window.location.replace(to);
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const base =
      mode === "describe"
        ? { kind: "describe" as const, text }
        : mode === "artists"
          ? { kind: "artists" as const, artists }
          : { kind: "song" as const, song };
    const input: HandoffInput = { ...base, sliders, sunoVersion: model };
    const href = buildStudioHref(input);
    if (!href) {
      setHint(
        mode === "describe"
          ? "Type a sound first, or tap one of the ideas."
          : mode === "artists"
            ? "Add at least one artist."
            : "Add a song title and artist.",
      );
      return;
    }
    router.history.push(href);
  };

  const copyExample = async () => {
    try {
      await navigator.clipboard.writeText(EXAMPLE_STYLE);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked; nothing to do */
    }
  };

  return (
    <div className="bb-landing">
      <header className="wrap top">
        <Link to="/" className="logo">
          <i aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
              <path d="M3 9v0M6.5 6v6M10 3v12M13.5 6v6" />
            </svg>
          </i>
          {APP_NAME}
        </Link>
        <nav aria-label="Main">
          <a className="hide-sm" href="#how">How it works</a>
          <Link className="hide-sm" to="/guides">Guides</Link>
          <a href="#faq">FAQ</a>
          <a className="open" href="/studio">Open the studio</a>
        </nav>
      </header>

      <main>
        {/* The tool itself is the hero. */}
        <section id="top" className="wrap hero">
          <h1 className="display">
            Describe the sound. <span>Get a Suno prompt that works.</span>
          </h1>
          <p className="lede">Free, built for Suno v6, checked for problems before you generate.</p>

          <div className="split">
            <form className="card" aria-label="Build a style prompt" onSubmit={submit} noValidate>
              <div className="tabs" role="tablist" aria-label="How to start">
                {(
                  [
                    ["describe", "Describe it"],
                    ["artists", "Blend artists"],
                    ["song", "One song"],
                  ] as const
                ).map(([m, label]) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={mode === m}
                    onClick={() => {
                      setMode(m);
                      setHint(null);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {mode === "describe" && (
                <div className="field">
                  <label className="field-label" htmlFor="l-desc">The sound you want</label>
                  <textarea
                    id="l-desc"
                    rows={3}
                    maxLength={500}
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      setHint(null);
                    }}
                    placeholder="90s grunge guitars with a dreamy synthwave chorus, female vocal…"
                  />
                  <div className="chips">
                    {CHIPS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setText(c);
                          setHint(null);
                        }}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {mode === "artists" && (
                <div className="field">
                  <span className="field-label">Up to three artists</span>
                  <div className="three">
                    {artists.map((a, i) => (
                      <input
                        key={i}
                        type="text"
                        maxLength={80}
                        aria-label={`Artist ${i + 1}${i === 2 ? " (optional)" : ""}`}
                        placeholder={`Artist ${i + 1}${i === 2 ? " (optional)" : ""}`}
                        value={a}
                        onChange={(e) => {
                          const next = [...artists];
                          next[i] = e.target.value;
                          setArtists(next);
                          setHint(null);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
              {mode === "song" && (
                <div className="field">
                  <label className="field-label" htmlFor="l-song">A song you love</label>
                  <input
                    id="l-song"
                    type="text"
                    maxLength={160}
                    placeholder="Song title and artist"
                    value={song}
                    onChange={(e) => {
                      setSong(e.target.value);
                      setHint(null);
                    }}
                  />
                </div>
              )}

              <div className="three sliders">
                {(["energy", "complexity", "brightness"] as const).map((k) => (
                  <label key={k}>
                    <span>
                      {k[0]!.toUpperCase() + k.slice(1)} <output>{sliders[k]}</output>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={sliders[k]}
                      onChange={(e) => setSliders({ ...sliders, [k]: Number(e.target.value) })}
                    />
                  </label>
                ))}
              </div>

              <div className="row">
                <div className="models" role="radiogroup" aria-label="Suno model">
                  {MODELS.map((m) => (
                    <button key={m} type="button" role="radio" aria-checked={model === m} onClick={() => setModel(m)}>
                      {SUNO_VERSION_LABELS[m]}
                    </button>
                  ))}
                </div>
                <button className="go" type="submit">Build my prompt</button>
              </div>
              {hint ? (
                <p className="hint" role="alert">{hint}</p>
              ) : (
                <p className="fineprint">v6-mini works on free Suno. v6 and v6-wild need Pro or Premier.</p>
              )}
            </form>

            <aside className="card" aria-label="Example result">
              <div className="row">
                <p className="label mono">EXAMPLE RESULT</p>
                <span className="pill">Pre-flight passed</span>
              </div>
              <div className="facts">
                <div className="box"><small>Genre</small><p><b>Grunge / Synthwave</b></p></div>
                <div className="box"><small>Tempo</small><p><b>96 bpm, half-time chorus</b></p></div>
              </div>
              <div className="box"><small>Style prompt</small><p className="mono">{EXAMPLE_STYLE}</p></div>
              <div className="box"><small>Exclude styles</small><p className="mono">trap beats, EDM drops, acoustic folk</p></div>
              <div className="btns">
                <button type="button" className="light" onClick={copyExample}>
                  {copied ? "Copied" : "Copy for Suno"}
                </button>
                <a className="ghost" href="/studio?tab=lyrics">Write lyrics next →</a>
              </div>
            </aside>
          </div>
        </section>

        <section id="tools" className="wrap jump">
          <h2 className="display">Or jump straight to</h2>
          <div className="grid">
            {JUMPS.map((j) => (
              <a key={j.title} className="tile" href={`/studio?tab=${j.tab}`}>
                <b>{j.title}</b>
                <span>{j.body}</span>
              </a>
            ))}
          </div>
        </section>

        <section className="limits" aria-label="Suno download limits">
          <div className="wrap">
            <h2 className="display">Suno now limits downloads. Make each one count.</h2>
            <div><p className="num">7</p><p className="sub">downloads, ever, on the free plan</p></div>
            <div><p className="num">20</p><p className="sub">a month on Pro</p></div>
            <div><p className="num">60</p><p className="sub">a month on Premier</p></div>
          </div>
        </section>

        <section id="how" className="wrap how">
          <h2 className="display">How it works</h2>
          <ol>
            <li>
              <p className="step mono">01</p>
              <h3>Shape the sound</h3>
              <p>Blend up to three artists or describe it in plain English. Get a Suno style prompt checked for contradictions before you generate.</p>
            </li>
            <li>
              <p className="step mono">02</p>
              <h3>Write lyrics that sing</h3>
              <p>Hook-first lyrics with per-line control, plus flags for clichés, awkward line lengths and words Suno tends to mispronounce.</p>
            </li>
            <li>
              <p className="step mono">03</p>
              <h3>Fix, master, release</h3>
              <p>Get edit instructions for Suno v6, master in your browser with a clear verdict, and work through a release checklist.</p>
            </li>
          </ol>
        </section>

        <section className="wrap privacy" aria-label="Privacy">
          <div className="card">
            <h2 className="display">Your music stays yours.</h2>
            <p>
              <strong>Audio never leaves your browser.</strong>
              Songs and stems are measured and mastered on your device, then gone when you close the tab.
            </p>
            <p>
              <strong>We never save your AI key.</strong>
              It stays in your browser. Free on your own Google or Anthropic key.
            </p>
          </div>
        </section>

        <section id="guides" className="wrap guides" aria-label="Guides">
          <h2 className="display">Guides</h2>
          <ul>
            {GUIDES.slice(0, 4).map((g) => (
              <li key={g.slug}>
                <Link to="/guides/$slug" params={{ slug: g.slug }}>
                  {g.title} <span aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section id="faq" className="wrap faq" aria-label="Questions">
          <h2 className="display">Questions</h2>
          {FAQ.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </section>

        <section className="wrap cta" aria-label="Get started">
          <div>
            <h2 className="display">Your next take could be the keeper.</h2>
            <a href="#top">Build a prompt →</a>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap">
          <span>{APP_NAME} · Not affiliated with Suno.</span>
          <nav aria-label="Footer">
            <a href="/studio">Studio</a>
            <Link to="/guides">Guides</Link>
            <a href="#faq">FAQ</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
