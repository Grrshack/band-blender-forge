import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";

type AuthState = {
  session: Session | null;
  ready: boolean;
  email: string | null;
  signOut: () => Promise<void>;
  /** True only when the signed-in email is on the admin list (checked by the database). */
  isAdmin: boolean;
  /** Feedback items still marked "New", for the admin badge. */
  newFeedback: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [newFeedback, setNewFeedback] = useState(0);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Ask the database whether this account is an admin. This only decides whether to show the
  // admin links; the data itself is protected by row-level security either way.
  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (!userId) {
      setIsAdmin(false);
      setNewFeedback(0);
      return;
    }
    let cancelled = false;
    const check = async () => {
      try {
        const { data: admin, error } = await db.rpc("is_feedback_admin");
        if (cancelled) return;
        const ok = !error && admin === true;
        setIsAdmin(ok);
        if (!ok) return;
        const { count } = await db
          .from("feedback")
          .select("id", { count: "exact", head: true })
          .eq("status", "new");
        if (!cancelled) setNewFeedback(count ?? 0);
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    };
    void check();
    // Recount when you come back to the tab, so the badge stays current without a reload.
    const onFocus = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [userId]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      ready,
      email: session?.user.email ?? null,
      signOut: async () => {
        await supabase.auth.signOut();
      },
      isAdmin,
      newFeedback,
    }),
    [session, ready, isAdmin, newFeedback],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/** Admin flag without throwing outside the provider (e.g. on pages that don't sign in). */
export function useAdminStatus() {
  const ctx = useContext(AuthContext);
  return { isAdmin: ctx?.isAdmin ?? false, newFeedback: ctx?.newFeedback ?? 0 };
}
