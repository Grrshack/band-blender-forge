import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

export type OptionalAuthContext = {
  supabase: SupabaseClient<Database> | null;
  userId: string | null;
};

const anonymous: OptionalAuthContext = { supabase: null, userId: null };

/**
 * Like requireSupabaseAuth, but never throws: a missing or invalid token just
 * means "anonymous". The handler decides what anonymous callers may do.
 * (The generated auth-middleware.ts is left untouched.)
 */
export const optionalSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    const header = getRequest()?.headers.get("authorization");

    if (!url || !key || !header?.startsWith("Bearer ")) return next({ context: anonymous });
    const token = header.slice("Bearer ".length);
    if (token.split(".").length !== 3) return next({ context: anonymous });

    const supabase = createClient<Database>(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims?.sub) return next({ context: anonymous });

    const context: OptionalAuthContext = { supabase, userId: data.claims.sub };
    return next({ context });
  },
);
