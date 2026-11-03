/**
 * Lab Picks on the server: list the live drop, the admin's schedule, publish and delete picks,
 * and the community's "Top 5 this week". Only the admin can add or schedule picks; the
 * database rules (supabase/migrations/20261103120000_lab_picks.sql) enforce that as well.
 *
 * Until that SQL has been run, the new columns don't exist: every read here then returns an
 * empty list instead of an error, so the Prompt Library keeps working.
 */
import { createServerFn } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { optionalSupabaseAuth } from "@/lib/optional-auth";
import type { PublicPrompt } from "@/lib/community.functions";

export type LabPick = Omit<PublicPrompt, "upvoted"> & { drop_at: string | null };

const COLUMNS =
  "id, title, style_tag, vocal_prompt, exclude_styles, artists, genre_tags, upvotes, created_at, suno_url, recipe_note, drop_at";

function anon(): SupabaseClient | null {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["SUPABASE_ANON_KEY"];
  return url && key ? createClient(url, key) : null;
}

/** The new columns and function aren't in the generated database types until Lovable refreshes them. */
const loose = (sb: unknown) => sb as SupabaseClient;

async function requireAdmin(sb: SupabaseClient | null, userId: string | null): Promise<SupabaseClient> {
  if (!sb || !userId) throw new Error("Sign in as the admin to use the Lab.");
  const { data, error } = await sb.rpc("is_feedback_admin");
  if (error || data !== true) throw new Error("Only the admin can do that.");
  return sb;
}

/** The newest drop that's live now (everyone), newest first. */
export const listLiveLabPicks = createServerFn({ method: "GET" }).handler(async () => {
  const sb = anon();
  if (!sb) return [] as LabPick[];
  const { data, error } = await sb
    .from("public_prompts")
    .select(COLUMNS)
    .eq("lab_pick", true)
    .lte("drop_at", new Date().toISOString())
    .order("drop_at", { ascending: false })
    .limit(12);
  return error ? ([] as LabPick[]) : ((data ?? []) as LabPick[]);
});

/** Everything the admin has scheduled or dropped, including future drops. */
export const listAdminLabPicks = createServerFn({ method: "GET" })
  .middleware([optionalSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await requireAdmin(loose(context.supabase), context.userId);
    const { data, error } = await sb
      .from("public_prompts")
      .select(COLUMNS)
      .eq("lab_pick", true)
      .order("drop_at", { ascending: false })
      .limit(80);
    if (error) {
      throw new Error(
        error.message.includes("lab_pick") || error.message.includes("drop_at")
          ? "Run supabase/migrations/20261103120000_lab_picks.sql in the database SQL editor first."
          : "Couldn't load your Lab Picks.",
      );
    }
    return (data ?? []) as LabPick[];
  });

const PickSchema = z.object({
  title: z.string().trim().min(3).max(80),
  style_tag: z.string().trim().min(5).max(1000),
  exclude_styles: z.string().trim().max(1000).optional(),
  vocal_prompt: z.record(z.string()).optional(),
  artists: z.array(z.string().trim().max(80)).max(3).default([]),
  genre_tags: z.array(z.string().trim().max(30)).max(3).default([]),
});

/** Saves reviewed picks as one drop. They stay hidden from everyone else until `dropAt`. */
export const publishLabPicks = createServerFn({ method: "POST" })
  .middleware([optionalSupabaseAuth])
  .validator(z.object({ dropAt: z.string().datetime({ offset: true }), picks: z.array(PickSchema).min(1).max(10) }))
  .handler(async ({ data, context }) => {
    const sb = await requireAdmin(loose(context.supabase), context.userId);
    const rows = data.picks.map((p) => ({
      user_id: context.userId,
      title: p.title,
      style_tag: p.style_tag,
      exclude_styles: p.exclude_styles || null,
      vocal_prompt: p.vocal_prompt ?? null,
      artists: p.artists.filter(Boolean),
      genre_tags: p.genre_tags,
      lab_pick: true,
      drop_at: new Date(data.dropAt).toISOString(),
    }));
    const { error } = await sb.from("public_prompts").insert(rows);
    if (error) {
      throw new Error(
        error.message.includes("lab_pick") || error.message.includes("drop_at")
          ? "Run supabase/migrations/20261103120000_lab_picks.sql in the database SQL editor first."
          : `Couldn't save the picks: ${error.message}`,
      );
    }
    return { ok: true, count: rows.length };
  });

export const deleteLabPick = createServerFn({ method: "POST" })
  .middleware([optionalSupabaseAuth])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const sb = await requireAdmin(loose(context.supabase), context.userId);
    const { error } = await sb.from("public_prompts").delete().eq("id", data.id).eq("lab_pick", true);
    if (error) throw new Error("Couldn't delete that pick.");
    return { ok: true };
  });

/** The most-upvoted prompts of the last 7 days (needs the SQL; empty until then). */
export const listWeeklyTop = createServerFn({ method: "GET" }).handler(async () => {
  const sb = anon();
  if (!sb) return [] as Array<LabPick & { votes: number }>;
  const { data: top, error } = await sb.rpc("weekly_top_prompts", { how_many: 5 });
  if (error || !Array.isArray(top) || !top.length) return [] as Array<LabPick & { votes: number }>;
  const votes = new Map((top as Array<{ prompt_id: string; votes: number }>).map((t) => [t.prompt_id, Number(t.votes)]));
  const { data: rows, error: e2 } = await sb.from("public_prompts").select(COLUMNS).in("id", [...votes.keys()]);
  if (e2 || !rows) return [] as Array<LabPick & { votes: number }>;
  return (rows as LabPick[])
    .map((r) => ({ ...r, votes: votes.get(r.id) ?? 0 }))
    .sort((a, b) => b.votes - a.votes);
});
