/**
 * Server functions for user-owned custom genre cards.
 * Uses requireSupabaseAuth — callers must be authenticated.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CustomGenreCard = {
  id: string;
  name: string;
  emoji: string;
  family: string;
  bpm: string;
  feel: string;
  instrumentation: string;
  vocals: string;
  style_template: string;
  exclude: string;
  notes: string;
  created_at: string;
};

const CardInputSchema = z.object({
  id:              z.string().uuid().optional(),   // present on update
  name:            z.string().trim().min(1).max(80),
  emoji:           z.string().trim().min(1).max(8).default("🎵"),
  family:          z.string().trim().max(40).default("Custom"),
  bpm:             z.string().trim().max(20).default(""),
  feel:            z.string().trim().max(120).default(""),
  instrumentation: z.string().trim().max(200).default(""),
  vocals:          z.string().trim().max(200).default(""),
  style_template:  z.string().trim().min(1).max(500),
  exclude:         z.string().trim().max(300).default(""),
  notes:           z.string().trim().max(500).default(""),
});

// ─── Server functions ─────────────────────────────────────────────────────────

/** Return all custom cards for the authenticated user, newest first. */
export const listCustomGenreCards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CustomGenreCard[]> => {
    const { data, error } = await context.supabase
      .from("custom_genre_cards")
      .select("id, name, emoji, family, bpm, feel, instrumentation, vocals, style_template, exclude, notes, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as CustomGenreCard[];
  });

/** Create or update a custom genre card. Returns the saved card. */
export const saveCustomGenreCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => CardInputSchema.parse(i))
  .handler(async ({ data, context }): Promise<CustomGenreCard> => {
    const row = {
      user_id:         context.userId,
      name:            data.name,
      emoji:           data.emoji,
      family:          data.family,
      bpm:             data.bpm,
      feel:            data.feel,
      instrumentation: data.instrumentation,
      vocals:          data.vocals,
      style_template:  data.style_template,
      exclude:         data.exclude,
      notes:           data.notes,
    };

    let result;
    if (data.id) {
      // Update existing card (RLS ensures only owner can update).
      result = await context.supabase
        .from("custom_genre_cards")
        .update(row)
        .eq("id", data.id)
        .select("id, name, emoji, family, bpm, feel, instrumentation, vocals, style_template, exclude, notes, created_at")
        .single();
    } else {
      result = await context.supabase
        .from("custom_genre_cards")
        .insert(row)
        .select("id, name, emoji, family, bpm, feel, instrumentation, vocals, style_template, exclude, notes, created_at")
        .single();
    }

    if (result.error) throw new Error(result.error.message);
    return result.data as CustomGenreCard;
  });

/** Delete a custom genre card by id. */
export const deleteCustomGenreCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<void> => {
    const { error } = await context.supabase
      .from("custom_genre_cards")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
  });
