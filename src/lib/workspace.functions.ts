import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const IdSchema = z.object({ id: z.string().uuid() });

export const listWorkspaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("workspaces")
      .select("id, name, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => IdSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("workspaces")
      .select("id, name, state, updated_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const createWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ name: z.string().trim().min(1).max(120), state: z.any() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("workspaces")
      .insert({ user_id: context.userId, name: data.name, state: data.state ?? {} })
      .select("id, name, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const saveWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(120).optional(),
        state: z.any().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch["name"] = data.name;
    if (data.state !== undefined) patch["state"] = data.state;
    const { error } = await context.supabase
      .from("workspaces")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => IdSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("workspaces").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listPresets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("prompt_presets")
      .select("id, user_id, title, body, kind, tags")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createPreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        title: z.string().trim().min(1).max(120),
        body: z.string().trim().min(1).max(4000),
        kind: z.enum(["style", "lyric", "structure"]),
        tags: z.array(z.string().trim().min(1).max(24)).max(8).default([]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("prompt_presets")
      .insert({
        user_id: context.userId,
        title: data.title,
        body: data.body,
        kind: data.kind,
        tags: data.tags,
      })
      .select("id, user_id, title, body, kind, tags")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deletePreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => IdSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("prompt_presets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
