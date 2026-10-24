import { Link, createFileRoute } from "@tanstack/react-router";
import { Download, Loader2, RefreshCw, Star } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { APP_NAME } from "@/lib/brand";
import {
  FEEDBACK_KINDS,
  FEEDBACK_STATUSES,
  feedbackCsv,
  type FeedbackRow,
  type FeedbackStatus,
} from "@/lib/feedback";
import { nameUsageTotals, type UsageTotals } from "@/lib/usage-summary";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/feedback")({
  head: () => ({
    meta: [{ title: `Feedback log | ${APP_NAME}` }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: FeedbackAdmin,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type Access = "checking" | "signed-out" | "not-admin" | "ok";

const KIND_LABEL = Object.fromEntries(FEEDBACK_KINDS.map((k) => [k.value, k.label]));
const KIND_STYLE: Record<string, string> = {
  bug: "border-red-500/40 text-red-300",
  confusing: "border-amber-500/40 text-amber-300",
  idea: "border-sky-500/40 text-sky-300",
  praise: "border-emerald-500/40 text-emerald-300",
};

function FeedbackAdmin() {
  const [access, setAccess] = useState<Access>("checking");
  const [email, setEmail] = useState("");
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [totals, setTotals] = useState<UsageTotals | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"open" | "all" | FeedbackStatus>("open");
  const [kind, setKind] = useState<"all" | string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) {
        setAccess("signed-out");
        return;
      }
      setEmail(s.session.user.email ?? "");
      const { data: isAdmin, error: rpcError } = await db.rpc("is_feedback_admin");
      if (rpcError) throw new Error("The feedback tables aren't set up yet. Run the Oct 21 SQL in Lovable.");
      if (!isAdmin) {
        setAccess("not-admin");
        return;
      }
      setAccess("ok");
      // Usage is counted in the database (admin_usage_summary): fetching raw rows would stop at
      // Supabase's 1,000-row limit and undercount.
      const [fb, us] = await Promise.all([
        db.from("feedback").select("*").order("created_at", { ascending: false }).limit(500),
        db.rpc("admin_usage_summary", { days: 7 }),
      ]);
      if (fb.error) throw new Error(fb.error.message);
      setRows(fb.data ?? []);
      setTotals(us.error ? null : (us.data as UsageTotals));
      if (us.error) setError("Usage totals need the Oct 24 SQL. Run it in Lovable's SQL panel.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the log.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const update = async (id: number, patch: Partial<Pick<FeedbackRow, "status" | "admin_note">>) => {
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const { error: e } = await db.from("feedback").update(patch).eq("id", id);
    if (e) setError("Couldn't save that change. Refresh and try again.");
  };

  const shown = useMemo(
    () =>
      rows.filter(
        (r) =>
          (status === "all" ? true : status === "open" ? !["done", "wont_do"].includes(r.status) : r.status === status) &&
          (kind === "all" || r.kind === kind),
      ),
    [rows, status, kind],
  );

  const usage = useMemo(
    () => (totals ? nameUsageTotals(totals) : { sessions: 0, tools: [], starts: [], actions: [] }),
    [totals],
  );
  const ratings = rows.filter((r) => r.rating).map((r) => r.rating!);
  const avg = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "—";

  const download = () => {
    const blob = new Blob([feedbackCsv(shown)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `feedback-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
              {APP_NAME}
            </Link>
            <h1 className="font-display text-3xl font-bold">Feedback log</h1>
            {email ? <p className="text-xs text-muted-foreground">Signed in as {email}</p> : null}
          </div>
          {access === "ok" ? (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => void load()} className="gap-1.5">
                {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={download} className="gap-1.5" disabled={!shown.length}>
                <Download className="size-3.5" /> Export CSV
              </Button>
            </div>
          ) : null}
        </div>

        {error ? <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">{error}</p> : null}

        {access === "checking" ? <Loader2 className="size-6 animate-spin text-muted-foreground" /> : null}
        {access === "signed-out" ? (
          <p className="rounded-lg border border-border p-6">
            Sign in with your admin email to see the log.{" "}
            <Link to="/auth" className="text-primary underline">
              Sign in
            </Link>
          </p>
        ) : null}
        {access === "not-admin" ? (
          <div className="space-y-2 rounded-lg border border-border p-6 text-sm">
            <p>{email} isn't on the admin list. Add it once in Lovable's SQL panel:</p>
            <pre className="overflow-x-auto rounded bg-card p-3 text-xs">
              {`INSERT INTO public.feedback_admins (email) VALUES (lower('${email}')) ON CONFLICT DO NOTHING;`}
            </pre>
            <p>Then refresh this page.</p>
          </div>
        ) : null}

        {access === "ok" ? (
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Open items", rows.filter((r) => !["done", "wont_do"].includes(r.status)).length],
                ["Bugs open", rows.filter((r) => r.kind === "bug" && !["done", "wont_do"].includes(r.status)).length],
                ["Average rating", avg],
                ["Visitors, last 7 days", usage.sessions],
              ].map(([label, n]) => (
                <div key={label} className="rounded-lg border border-border p-4">
                  <p className="text-2xl font-bold">{n}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>

            <section>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="mr-2 font-display text-xl font-semibold">Feedback</h2>
                <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="rounded-md border border-border bg-card px-2 py-1.5 text-sm" aria-label="Status filter">
                  <option value="open">Open (not done)</option>
                  <option value="all">All</option>
                  {FEEDBACK_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-md border border-border bg-card px-2 py-1.5 text-sm" aria-label="Type filter">
                  <option value="all">All types</option>
                  {FEEDBACK_KINDS.map((k) => (
                    <option key={k.value} value={k.value}>{k.label}</option>
                  ))}
                </select>
                <span className="text-xs text-muted-foreground">{shown.length} shown</span>
              </div>

              {shown.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Nothing here yet. Testers send feedback with the Feedback button at the bottom left of every page.
                </p>
              ) : (
                <ul className="space-y-3">
                  {shown.map((r) => (
                    <li key={r.id} className="rounded-lg border border-border bg-card/40 p-4">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className={cn("rounded-full border px-2 py-0.5", KIND_STYLE[r.kind])}>{KIND_LABEL[r.kind]}</span>
                        <span>{new Date(r.created_at).toLocaleString()}</span>
                        <span>·</span>
                        <span className="text-foreground">{r.tester_name || r.user_email || "Anonymous"}</span>
                        {r.tester_name && r.user_email ? <span>({r.user_email})</span> : null}
                        {r.rating ? (
                          <span className="flex items-center gap-0.5">
                            · {r.rating} <Star className="size-3 fill-amber-400 text-amber-400" />
                          </span>
                        ) : null}
                        <span className="ml-auto">
                          <select
                            value={r.status}
                            onChange={(e) => void update(r.id, { status: e.target.value as FeedbackStatus })}
                            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                            aria-label="Status"
                          >
                            {FEEDBACK_STATUSES.map((s) => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm">{r.message}</p>
                      {r.suggestion ? (
                        <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">Suggestion: </span>
                          {r.suggestion}
                        </p>
                      ) : null}
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {r.tool ? `Tool: ${r.tool} · ` : ""}Page: {r.page || "—"} · {r.device}
                      </p>
                      <input
                        defaultValue={r.admin_note}
                        onBlur={(e) => e.target.value !== r.admin_note && void update(r.id, { admin_note: e.target.value.slice(0, 1000) })}
                        placeholder="Your note (saved when you click away)"
                        className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="mb-1 font-display text-xl font-semibold">Usage, last 7 days</h2>
              <p className="mb-3 text-xs text-muted-foreground">
                Anonymous: a visitor is one browser tab session. AI errors count failed AI requests.
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  ["Tools opened (visitors)", usage.tools],
                  ["How people started", usage.starts],
                  ["Other actions", usage.actions],
                ].map(([title, list]) => (
                  <div key={title as string} className="rounded-lg border border-border p-4">
                    <h3 className="mb-2 text-sm font-medium">{title as string}</h3>
                    {(list as Array<{ label: string; count: number }>).length ? (
                      <ol className="space-y-1 text-sm">
                        {(list as Array<{ label: string; count: number }>).map((x) => (
                          <li key={x.label} className="flex justify-between gap-3">
                            <span className="truncate text-muted-foreground">{x.label}</span>
                            <span className="font-mono">{x.count}</span>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="text-xs text-muted-foreground">No data yet.</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
