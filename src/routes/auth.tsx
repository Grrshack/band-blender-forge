import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AudioLines, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Band Lookup & Lyric Forge" },
      {
        name: "description",
        content:
          "Sign in to save your blend, lyrics, comparable artists and prompt presets across sessions.",
      },
      { property: "og:title", content: "Sign in — Band Lookup & Lyric Forge" },
      {
        property: "og:description",
        content: "Save your song sessions and prompt library to your account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/" });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Account created. You're signed in.");
          navigate({ to: "/" });
        } else {
          toast.success("Check your email to confirm your account before signing in.");
          setMode("in");
          setPassword("");
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="panel-surface glow-primary w-full max-w-sm p-6">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl border border-primary/40 bg-primary/10">
            <AudioLines className="size-5 text-primary" />
          </span>
          <div>
            <h1 className="neon-text font-display text-lg font-bold">Band Lookup &amp; Lyric Forge</h1>
            <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              {mode === "in" ? "Sign in" : "Create account"}
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={google}
          className="mb-4 h-11 w-full border-border bg-card/60"
        >
          Continue with Google
        </Button>

        <div className="mb-4 flex items-center gap-3 text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
          <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@studio.com"
            className="h-11 border-border bg-card/60"
          />
          <Input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="h-11 border-border bg-card/60"
          />
          <Button type="submit" disabled={busy} className="glow-primary h-11 w-full gap-2">
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {mode === "in" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "in" ? "up" : "in")}
          className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
        >
          {mode === "in" ? "No account yet? Create one" : "Already have an account? Sign in"}
        </button>
        <button
          type="button"
          onClick={() => navigate({ to: "/" })}
          className="mt-2 w-full text-center text-xs text-muted-foreground hover:text-foreground"
        >
          Keep working without an account
        </button>
      </div>
      <Toaster />
    </div>
  );
}
