import { useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";

import { useSettings } from "./settings";
import { runForge } from "@/lib/forge.functions";
import { NO_KEY_MESSAGE, isGeminiKey } from "@/lib/provider";
import { TIMEOUT_MESSAGE, isTimeoutLike } from "@/lib/provider-errors";
import { toast } from "sonner";
import { track } from "@/lib/stats";

type ForgeCall = ReturnType<typeof useServerFn<typeof runForge>>;

/**
 * Every AI tool calls the model through this hook. In own-key mode, a call without a key
 * opens the key setup card instead of reaching the server, and the tool shows the same
 * friendly message in its error slot.
 */
export function useForge(): ForgeCall {
  const forge = useServerFn(runForge);
  const { apiKey, builtIn, openKeyDialog, geminiNoPro, setGeminiNoPro } = useSettings();

  return useCallback(
    (async (args: Parameters<ForgeCall>[0]) => {
      if (!builtIn && !apiKey.trim()) {
        openKeyDialog();
        throw new Error(NO_KEY_MESSAGE);
      }
      const task = (args as { data?: { task?: string } } | undefined)?.data?.task ?? "";
      track("ai_call", task);
      const gemini = Boolean(apiKey.trim()) && isGeminiKey(apiKey.trim());
      const withHint =
        gemini && geminiNoPro && args?.data
          ? ({ ...args, data: { ...args.data, preferFast: true } } as typeof args)
          : args;
      // A timeout (the host's "error code: 524") or dropped connection is retried once
      // automatically, asking for the faster model, before the person sees an error.
      const attempt = async () => {
        try {
          return await forge(withHint);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (!isTimeoutLike(msg)) throw e;
          toast.info("That took too long. Trying again with the faster model…", { duration: 5000 });
          const fast = withHint?.data
            ? ({ ...withHint, data: { ...withHint.data, preferFast: true, routing: "fast" } } as typeof withHint)
            : withHint;
          try {
            return await forge(fast);
          } catch (e2) {
            const msg2 = e2 instanceof Error ? e2.message : String(e2);
            // Never show a raw "error code: 524" page.
            throw isTimeoutLike(msg2) ? new Error(TIMEOUT_MESSAGE) : e2;
          }
        }
      };
      try {
        const res = await attempt();
        if (res.downgraded && !geminiNoPro) {
          setGeminiNoPro(true);
          toast.info(
            "Your Google key is on the free tier, which doesn't include Gemini Pro, so this used Gemini Flash. Turn on billing in Google AI Studio to use Pro.",
            { duration: 9000 },
          );
        }
        return res;
      } catch (e) {
        track("ai_error", task);
        if (e instanceof Error && e.message.includes(NO_KEY_MESSAGE)) openKeyDialog();
        throw e;
      }
    }) as ForgeCall,
    [forge, apiKey, builtIn, openKeyDialog, geminiNoPro, setGeminiNoPro],
  );
}
