import { ChevronUp, Cpu, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { useSettings } from "./settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function SystemPanel() {
  const { apiKey, setApiKey, routing, setRouting } = useSettings();
  const [open, setOpen] = useState(false);
  const [reveal, setReveal] = useState(false);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-3">
      <div className="pointer-events-auto w-full max-w-3xl">
        {open ? (
          <div className="panel-surface glow-primary mb-2 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                  Anthropic API Key
                </label>
                <div className="flex gap-2">
                  <Input
                    type={reveal ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-ant-…  (optional)"
                    className="border-border bg-card/60 font-mono text-xs focus-visible:ring-primary"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setReveal((v) => !v)}
                    className="shrink-0"
                  >
                    {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Held in this browser tab's session only. Leave blank to use the built-in model.
                </p>
              </div>

              <div>
                <span className="mb-2 block font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                  Model Routing Type
                </span>
                <div className="flex items-center gap-3 rounded-lg border border-border bg-card/60 p-3">
                  <span
                    className={cn(
                      "text-xs",
                      routing === "fast" ? "text-accent" : "text-muted-foreground",
                    )}
                  >
                    A · Fast &amp; Economic (Haiku)
                  </span>
                  <Switch
                    checked={routing === "craft"}
                    onCheckedChange={(v) => setRouting(v ? "craft" : "fast")}
                  />
                  <span
                    className={cn(
                      "text-xs",
                      routing === "craft" ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    B · Creative Craft (Sonnet)
                  </span>
                </div>
              </div>
            </div>

            <p className="hairline-top mt-4 flex items-start gap-2 pt-3 text-[11px] leading-relaxed text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-signal-high" />
              <span>
                Signed out, nothing leaves this tab. Signed in, only the sessions and presets you
                save are stored, they are private to your account, and you can delete any of them at
                any time. Your API key is never stored — it lives in this browser tab only and is
                sent straight to the model at request time. No audio is ever uploaded.
              </span>
            </p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="panel-surface flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:border-primary/50"
        >
          <span className="flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
            <Cpu className="size-3.5 text-primary" />
            System &amp; Credentials
          </span>
          <span className="flex items-center gap-3">
            <span className="font-mono text-[10px] text-accent">
              {apiKey ? "ANTHROPIC KEY SET" : "BUILT-IN MODEL"} ·{" "}
              {routing === "fast" ? "FAST" : "CRAFT"}
            </span>
            <ChevronUp
              className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")}
            />
          </span>
        </button>
      </div>
    </div>
  );
}
