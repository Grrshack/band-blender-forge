import { useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";

import { useSettings } from "./settings";
import { runForge } from "@/lib/forge.functions";
import { NO_KEY_MESSAGE, isGeminiKey } from "@/lib/provider";
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
      try {
        const res = await forge(withHint);
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
