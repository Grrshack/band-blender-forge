import type { SupabaseClient } from "@supabase/supabase-js";

/** Built-in-model calls allowed per signed-in user per rolling hour. */
export const BUILT_IN_CALLS_PER_HOUR = 120;

export type UsageResult = {
  allowed: boolean;
  used: number;
  /** True when the usage table could not be read/written and the call was let through. */
  failedOpen: boolean;
};

/**
 * Counts this user's calls in the last hour and, if under the limit, records one more.
 * Fails OPEN: if the `ai_usage` table is missing (migration not applied yet) or the
 * database errors, the call is allowed — a missing migration must not take the app down.
 */
export async function consumeUsage(
  // The ai_usage table is not in the generated Database types, so the client is untyped here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  task: string,
  limit = BUILT_IN_CALLS_PER_HOUR,
  now: number = Date.now(),
): Promise<UsageResult> {
  const since = new Date(now - 60 * 60 * 1000).toISOString();

  const counted = await supabase
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);
  if (counted.error) return { allowed: true, used: 0, failedOpen: true };

  const used = counted.count ?? 0;
  if (used >= limit) return { allowed: false, used, failedOpen: false };

  const inserted = await supabase.from("ai_usage").insert({ user_id: userId, task });
  return { allowed: true, used: used + 1, failedOpen: Boolean(inserted.error) };
}
