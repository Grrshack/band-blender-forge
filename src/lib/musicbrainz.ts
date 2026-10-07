/**
 * Artist grounding via MusicBrainz (free, no key). Used to check that an artist
 * really exists and to fetch community genre tags, so the model is not the only
 * judge of its own familiarity.
 *
 * MusicBrainz allows ~1 request/second per IP and requires a descriptive
 * User-Agent. Shared server IPs can be throttled, so this is strictly
 * best-effort: a failed lookup is reported as "unavailable", never as
 * "not found".
 */

export type LookupStatus = "found" | "not_found" | "unavailable";

export type ArtistLookup = {
  /** The name as the user/model wrote it. */
  name: string;
  status: LookupStatus;
  /** MusicBrainz's canonical spelling, when found. */
  matchedName?: string;
  /** Community genre/style tags, most-voted first. */
  tags: string[];
  country?: string;
  type?: string;
};

type Options = {
  /** Contact for the User-Agent (email or URL), as MusicBrainz asks. */
  contact?: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  /** Gap between network requests. */
  delayMs?: number;
  /** Per-request timeout. */
  timeoutMs?: number;
  /** Total time allowed for the whole batch; later names become "unavailable". */
  budgetMs?: number;
  now?: () => number;
};

type MbArtist = {
  name?: string;
  score?: number;
  country?: string;
  type?: string;
  aliases?: Array<{ name?: string }>;
  tags?: Array<{ name?: string; count?: number }>;
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; value: ArtistLookup }>();

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const sameName = (a: string, b: string) => {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  const strip = (s: string) => s.replace(/^the /, "");
  return x === y || strip(x) === strip(y);
};

function parse(input: string, artists: MbArtist[]): ArtistLookup {
  const scored = artists
    .filter((a) => typeof a.name === "string")
    .map((a) => ({
      a,
      exact:
        sameName(a.name!, input) ||
        (a.aliases ?? []).some((al) => al.name && sameName(al.name, input)),
      score: a.score ?? 0,
    }));

  // Accept an exact (normalised) name/alias match, or MusicBrainz's own perfect score.
  const pool = scored.filter((s) => (s.exact && s.score >= 80) || s.score === 100);
  if (!pool.length) return { name: input, status: "not_found", tags: [] };

  pool.sort((p, q) => Number(q.exact) - Number(p.exact) || q.score - p.score);
  const best = pool[0]!.a;
  const tags = (best.tags ?? [])
    .filter((t) => t.name && (t.count ?? 0) > 0)
    .sort((x, y) => (y.count ?? 0) - (x.count ?? 0))
    .slice(0, 6)
    .map((t) => t.name!);

  return {
    name: input,
    status: "found",
    matchedName: best.name!,
    tags,
    ...(best.country ? { country: best.country } : {}),
    ...(best.type ? { type: best.type } : {}),
  };
}

async function lookupOne(
  name: string,
  o: Required<Pick<Options, "fetchImpl" | "timeoutMs">> & { userAgent: string },
): Promise<ArtistLookup> {
  const unavailable: ArtistLookup = { name, status: "unavailable", tags: [] };
  const query = `artist:"${name.replace(/["\\]/g, " ").trim()}"`;
  const url = `https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(query)}&fmt=json&limit=5`;

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), o.timeoutMs);
  try {
    const res = await o.fetchImpl(url, {
      headers: { "User-Agent": o.userAgent, Accept: "application/json" },
      signal: ctl.signal,
    });
    if (!res.ok) return unavailable; // 503/429 = rate limited, anything else = treat as unknown
    const json = (await res.json()) as { artists?: MbArtist[] };
    if (!json || !Array.isArray(json.artists)) return unavailable;
    return parse(name, json.artists);
  } catch {
    return unavailable;
  } finally {
    clearTimeout(timer);
  }
}

/** Looks up each name in order, spacing network calls to respect the rate limit. */
export async function lookupArtists(names: string[], opts: Options = {}): Promise<ArtistLookup[]> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = opts.now ?? Date.now;
  const delayMs = opts.delayMs ?? 1100;
  const timeoutMs = opts.timeoutMs ?? 4000;
  const budgetMs = opts.budgetMs ?? 9000;
  // MusicBrainz asks for contact info in the User-Agent. Only send one the owner supplied;
  // never invent one.
  const userAgent = opts.contact
    ? `BandBlenderForge/1.0 ( ${opts.contact} )`
    : "BandBlenderForge/1.0";

  const started = now();
  let networkCalls = 0;
  const out: ArtistLookup[] = [];

  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;

    const key = norm(name);
    const hit = cache.get(key);
    if (hit && now() - hit.at < CACHE_TTL_MS) {
      out.push({ ...hit.value, name });
      continue;
    }

    // Budget covers the rate-limit wait that precedes this request, so the batch
    // can never overrun it by sleeping first.
    const wait = networkCalls > 0 ? delayMs : 0;
    if (now() - started + wait >= budgetMs) {
      out.push({ name, status: "unavailable", tags: [] });
      continue;
    }

    if (wait > 0) await sleep(wait);
    networkCalls++;

    const result = await lookupOne(name, { fetchImpl, timeoutMs, userAgent });
    if (result.status !== "unavailable") cache.set(key, { at: now(), value: result });
    out.push(result);
  }
  return out;
}

/** Test helper. */
export function clearLookupCache(): void {
  cache.clear();
}

// ─── Song / recording lookup ────────────────────────────────────────────────

export type RecordingLookup = {
  title: string;
  artist: string;
  status: LookupStatus;
  matchedTitle?: string;
  matchedArtist?: string;
  tags: string[];
  releaseYear?: string;
};

type MbRecording = {
  title?: string;
  score?: number;
  "artist-credit"?: Array<{ name?: string; artist?: { name?: string } }>;
  tags?: Array<{ name?: string; count?: number }>;
  releases?: Array<{ date?: string }>;
};

/**
 * Look up a specific song recording in MusicBrainz.
 * Returns "not_found" when it genuinely isn't there (unknown release, typo, etc.).
 * Returns "unavailable" only when the network request itself failed.
 *
 * Note: MusicBrainz recording data is far sparser than artist data — genre tags
 * are often missing, and obscure or recent tracks frequently come back not_found.
 */
export async function lookupRecording(
  title: string,
  artist: string,
  opts: Options = {},
): Promise<RecordingLookup> {
  const unavailable: RecordingLookup = { title, artist, status: "unavailable", tags: [] };
  const notFound: RecordingLookup = { title, artist, status: "not_found", tags: [] };

  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 5000;
  const userAgent = opts.contact
    ? `BandBlenderForge/1.0 ( ${opts.contact} )`
    : "BandBlenderForge/1.0";

  const titlePart = `recording:"${title.replace(/["\\/]/g, " ").trim()}"`;
  const artistPart = artist.trim() ? ` AND artist:"${artist.replace(/["\\/]/g, " ").trim()}"` : "";
  const url = `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(titlePart + artistPart)}&fmt=json&limit=5`;

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      headers: { "User-Agent": userAgent, Accept: "application/json" },
      signal: ctl.signal,
    });
    if (!res.ok) return unavailable;
    const json = (await res.json()) as { recordings?: MbRecording[] };
    if (!json || !Array.isArray(json.recordings) || json.recordings.length === 0) return notFound;

    // Accept the top result if MusicBrainz gives it a strong score.
    const best = json.recordings
      .filter((r) => (r.score ?? 0) >= 80)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
    if (!best) return notFound;

    const matchedTitle = best.title ?? title;
    const matchedArtist =
      best["artist-credit"]?.[0]?.name ?? best["artist-credit"]?.[0]?.artist?.name ?? artist;
    const tags = (best.tags ?? [])
      .filter((t) => t.name && (t.count ?? 0) > 0)
      .sort((x, y) => (y.count ?? 0) - (x.count ?? 0))
      .slice(0, 6)
      .map((t) => t.name!);
    const releaseYear = best.releases?.[0]?.date?.slice(0, 4);

    return {
      title,
      artist,
      status: "found",
      matchedTitle,
      matchedArtist,
      tags,
      ...(releaseYear ? { releaseYear } : {}),
    };
  } catch {
    return unavailable;
  } finally {
    clearTimeout(timer);
  }
}
