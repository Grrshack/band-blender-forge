/**
 * Serverless share links and exports. A share link carries the whole sheet inside the
 * URL fragment (the part after #), so nothing is stored on any server — and nothing can
 * be revoked either. Fragments are never sent to the website's server.
 */

export type SharePayload = {
  v: 1;
  title: string;
  style: string;
  exclude: string;
  vocal: string;
  lyrics: string;
};

const LIMITS = { title: 200, style: 1500, exclude: 1500, vocal: 1500, lyrics: 8000 } as const;

const toB64Url = (bytes: Uint8Array) => {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const fromB64Url = (s: string) => {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const copy = new Uint8Array(bytes); // plain ArrayBuffer-backed copy
  const out = new Response(new Blob([copy]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/** "z." = deflate-compressed, "r." = raw (used where CompressionStream is unavailable). */
export async function encodeShare(payload: SharePayload): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify(payload));
  if (typeof CompressionStream !== "undefined") {
    return `z.${toB64Url(await pipe(raw, new CompressionStream("deflate-raw")))}`;
  }
  return `r.${toB64Url(raw)}`;
}

const isStr = (x: unknown, max: number): x is string => typeof x === "string" && x.length <= max;

/** Returns null for anything malformed, oversized or not from this app. */
export async function decodeShare(token: string): Promise<SharePayload | null> {
  try {
    const kind = token.slice(0, 2);
    const body = token.slice(2);
    if ((kind !== "z." && kind !== "r.") || !body || body.length > 60_000) return null;
    let bytes = fromB64Url(body);
    if (kind === "z.") {
      if (typeof DecompressionStream === "undefined") return null;
      bytes = await pipe(bytes, new DecompressionStream("deflate-raw"));
    }
    if (bytes.length > 200_000) return null;
    const p = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    if (
      p["v"] !== 1 ||
      !isStr(p["title"], LIMITS.title) ||
      !isStr(p["style"], LIMITS.style) ||
      !isStr(p["exclude"], LIMITS.exclude) ||
      !isStr(p["vocal"], LIMITS.vocal) ||
      !isStr(p["lyrics"], LIMITS.lyrics)
    ) {
      return null;
    }
    return {
      v: 1,
      title: p["title"],
      style: p["style"],
      exclude: p["exclude"],
      vocal: p["vocal"],
      lyrics: p["lyrics"],
    };
  } catch {
    return null;
  }
}

export function shareUrl(origin: string, path: string, token: string): string {
  return `${origin}${path}#share=${token}`;
}

export function tokenFromHash(hash: string): string | null {
  const m = /^#share=([A-Za-z0-9_.-]+)$/.exec(hash);
  return m ? m[1]! : null;
}

export function exportText(p: SharePayload): string {
  return [
    `TITLE\n${p.title}`,
    `STYLE OF MUSIC\n${p.style}`,
    p.exclude ? `EXCLUDE STYLES\n${p.exclude}` : "",
    p.vocal ? `VOCAL LINE\n${p.vocal}` : "",
    `LYRICS\n${p.lyrics}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function exportMarkdown(p: SharePayload): string {
  return [
    `# ${p.title || "Untitled"}`,
    `## Style of music\n\n\`\`\`\n${p.style}\n\`\`\``,
    p.exclude ? `## Exclude styles\n\n\`\`\`\n${p.exclude}\n\`\`\`` : "",
    p.vocal ? `## Vocal line\n\n${p.vocal}` : "",
    `## Lyrics\n\n\`\`\`\n${p.lyrics}\n\`\`\``,
  ]
    .filter(Boolean)
    .join("\n\n");
}
