import { describe, it, expect, vi } from "vitest";
import { consumeUsage, BUILT_IN_CALLS_PER_HOUR } from "@/lib/usage-limit";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── minimal Supabase mock builder ────────────────────────────────────────────

/** Builds a chainable Supabase mock where `.from().select().eq().gte()` resolves to `selectResult`
 *  and `.from().insert()` resolves to `insertResult`. */
function makeClient(
  selectResult: { count: number | null; error: null | { message: string } },
  insertResult: { error: null | { message: string } } = { error: null },
): SupabaseClient {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockResolvedValue(selectResult),
    insert: vi.fn().mockResolvedValue(insertResult),
  };
  return {
    from: vi.fn().mockReturnValue(chain),
  } as unknown as SupabaseClient;
}

const NOW = 1_700_000_000_000; // fixed timestamp for deterministic tests

// ── happy path ───────────────────────────────────────────────────────────────

describe("consumeUsage", () => {
  it("allows a call when usage is below the limit and records it", async () => {
    const supabase = makeClient({ count: 10, error: null });
    const result = await consumeUsage(supabase, "user-1", "blend", 120, NOW);
    expect(result).toEqual({ allowed: true, used: 11, failedOpen: false });
  });

  it("allows the call at exactly the limit minus one (last allowed call)", async () => {
    const supabase = makeClient({ count: 119, error: null });
    const result = await consumeUsage(supabase, "user-1", "blend", 120, NOW);
    expect(result).toEqual({ allowed: true, used: 120, failedOpen: false });
  });

  it("denies the call when usage equals the limit", async () => {
    const supabase = makeClient({ count: 120, error: null });
    const result = await consumeUsage(supabase, "user-1", "blend", 120, NOW);
    expect(result).toEqual({ allowed: false, used: 120, failedOpen: false });
  });

  it("denies when usage exceeds the limit", async () => {
    const supabase = makeClient({ count: 150, error: null });
    const result = await consumeUsage(supabase, "user-1", "blend", 120, NOW);
    expect(result).toEqual({ allowed: false, used: 150, failedOpen: false });
  });

  it("uses BUILT_IN_CALLS_PER_HOUR (120) as the default limit", async () => {
    expect(BUILT_IN_CALLS_PER_HOUR).toBe(120);
    const supabase = makeClient({ count: 120, error: null });
    // no explicit limit — should default to 120
    const result = await consumeUsage(supabase, "user-1", "blend", undefined, NOW);
    expect(result.allowed).toBe(false);
  });

  it("fails open when the select errors", async () => {
    const supabase = makeClient({ count: null, error: { message: "table missing" } });
    const result = await consumeUsage(supabase, "user-1", "blend", 120, NOW);
    expect(result).toEqual({ allowed: true, used: 0, failedOpen: true });
  });

  it("allows but marks failedOpen when insert errors", async () => {
    const supabase = makeClient(
      { count: 5, error: null },
      { error: { message: "write failed" } },
    );
    const result = await consumeUsage(supabase, "user-1", "blend", 120, NOW);
    expect(result).toEqual({ allowed: true, used: 6, failedOpen: true });
  });

  it("treats a null count as zero (fails open gracefully)", async () => {
    const supabase = makeClient({ count: null, error: null });
    // null count → used = 0, which is < limit → allowed
    const result = await consumeUsage(supabase, "user-1", "blend", 120, NOW);
    expect(result.allowed).toBe(true);
    expect(result.used).toBe(1);
  });

  it("scopes the count query to the provided userId", async () => {
    const supabase = makeClient({ count: 0, error: null });
    await consumeUsage(supabase, "user-xyz", "blend", 120, NOW);
    // The mock's from() chains must have been called with eq("user_id", "user-xyz")
    const fromResult = (supabase.from as ReturnType<typeof vi.fn>).mock.results[0]?.value as {
      eq: ReturnType<typeof vi.fn>;
    };
    expect(fromResult.eq).toHaveBeenCalledWith("user_id", "user-xyz");
  });
});
