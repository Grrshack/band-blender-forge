import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { optionalSupabaseAuth } from "@/lib/optional-auth";

// ─── Helpers ────────────────────────────────────────────────────────────────

function anonClient() {
  return createClient(
    process.env["SUPABASE_URL"] ?? "",
    process.env["SUPABASE_ANON_KEY"] ?? "",
  );
}

// ─── Public prompt library ───────────────────────────────────────────────────

export type PublicPrompt = {
  id: string;
  title: string;
  style_tag: string;
  vocal_prompt: Record<string, string> | null;
  exclude_styles: string | null;
  artists: string[];
  genre_tags: string[];
  upvotes: number;
  created_at: string;
  /** True when the current user has upvoted this. */
  upvoted?: boolean;
};

export const listPublicPrompts = createServerFn({ method: "GET" })
  .middleware([optionalSupabaseAuth])
  .validator(
    z.object({
      genre: z.string().optional(),
      query: z.string().optional(),
      limit: z.number().int().max(50).default(24),
      offset: z.number().int().default(0),
    }),
  )
  .handler(async ({ data, context }) => {
    const sb = anonClient();
    let q = sb
      .from("public_prompts")
      .select("id, title, style_tag, vocal_prompt, exclude_styles, artists, genre_tags, upvotes, created_at")
      .order("upvotes", { ascending: false })
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);

    if (data.genre) {
      q = q.contains("genre_tags", [data.genre]);
    }
    if (data.query) {
      q = q.ilike("title", `%${data.query}%`);
    }

    const { data: rows, error } = await q;
    if (error) throw new Error("Could not load community prompts.");

    // If the user is signed in, check which ones they've upvoted.
    let upvotedIds = new Set<string>();
    if (context.userId && rows && rows.length > 0) {
      const ids = rows.map((r) => r.id);
      const { data: votes } = await context.supabase!
        .from("prompt_upvotes")
        .select("prompt_id")
        .in("prompt_id", ids)
        .eq("user_id", context.userId);
      if (votes) upvotedIds = new Set(votes.map((v) => v.prompt_id));
    }

    return (rows ?? []).map((r) => ({ ...r, upvoted: upvotedIds.has(r.id) })) as PublicPrompt[];
  });

export const submitPublicPrompt = createServerFn({ method: "POST" })
  .middleware([optionalSupabaseAuth])
  .validator(
    z.object({
      title: z.string().min(3).max(80),
      style_tag: z.string().min(5).max(1000),
      vocal_prompt: z.record(z.string()).optional(),
      exclude_styles: z.string().optional(),
      artists: z.array(z.string()).default([]),
      genre_tags: z.array(z.string()).default([]),
    }),
  )
  .handler(async ({ data, context }) => {
    if (!context.supabase || !context.userId) {
      throw new Error("Sign in to submit a prompt.");
    }
    const { error } = await context.supabase.from("public_prompts").insert({
      user_id: context.userId,
      title: data.title,
      style_tag: data.style_tag,
      vocal_prompt: data.vocal_prompt ?? null,
      exclude_styles: data.exclude_styles ?? null,
      artists: data.artists,
      genre_tags: data.genre_tags,
    });
    if (error) throw new Error("Could not submit prompt: " + error.message);
    return { ok: true };
  });

export const toggleUpvote = createServerFn({ method: "POST" })
  .middleware([optionalSupabaseAuth])
  .validator(z.object({ promptId: z.string().uuid(), currentlyUpvoted: z.boolean() }))
  .handler(async ({ data, context }) => {
    if (!context.supabase || !context.userId) {
      throw new Error("Sign in to upvote.");
    }
    if (data.currentlyUpvoted) {
      await context.supabase
        .from("prompt_upvotes")
        .delete()
        .eq("user_id", context.userId)
        .eq("prompt_id", data.promptId);
    } else {
      await context.supabase
        .from("prompt_upvotes")
        .insert({ user_id: context.userId, prompt_id: data.promptId });
    }
    return { ok: true };
  });

// ─── Usage dashboard ─────────────────────────────────────────────────────────

export type UsageDay = { day: string; task: string; calls: number };
export type UsageSummary = { total_calls: number; calls_24h: number; calls_7d: number };

export const getMyUsage = createServerFn({ method: "GET" })
  .middleware([optionalSupabaseAuth])
  .handler(async ({ context }) => {
    if (!context.supabase || !context.userId) {
      return { days: [] as UsageDay[], summary: null as UsageSummary | null };
    }

    // Last 14 days by task
    const since14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: rows } = await context.supabase
      .from("ai_usage")
      .select("created_at, task")
      .eq("user_id", context.userId)
      .gte("created_at", since14)
      .order("created_at", { ascending: true });

    // Group by day + task client-side (avoids needing view access with anon key)
    const dayMap = new Map<string, Map<string, number>>();
    for (const row of rows ?? []) {
      const day = row.created_at.slice(0, 10);
      if (!dayMap.has(day)) dayMap.set(day, new Map());
      const taskMap = dayMap.get(day)!;
      taskMap.set(row.task, (taskMap.get(row.task) ?? 0) + 1);
    }
    const days: UsageDay[] = [];
    for (const [day, tasks] of dayMap) {
      for (const [task, calls] of tasks) {
        days.push({ day, task, calls });
      }
    }

    const all = rows ?? [];
    const now = Date.now();
    const summary: UsageSummary = {
      total_calls: all.length,
      calls_24h: all.filter((r) => new Date(r.created_at).getTime() > now - 86400000).length,
      calls_7d: all.filter((r) => new Date(r.created_at).getTime() > now - 7 * 86400000).length,
    };

    return { days, summary };
  });
