import { useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";

import { useSettings } from "./settings";
import { runForge } from "@/lib/forge.functions";
import { NO_KEY_MESSAGE } from "@/lib/provider";

type ForgeCall = ReturnType<typeof useServerFn<typeof runForge>>;

/**
 * Every AI tool calls the model through this hook. In own-key mode, a call without a key
 * opens the key setup card instead of reaching the server, and the tool shows the same
 * friendly message in its error slot.
 */
export function useForge(): ForgeCall {
  const forge = useServerFn(runForge);
  const { apiKey, builtIn, openKeyDialog } = useSettings();

  return useCallback(
    (async (args: Parameters<ForgeCall>[0]) => {
      if (!builtIn && !apiKey.trim()) {
        openKeyDialog();
        throw new Error(NO_KEY_MESSAGE);
      }
      try {
        return await forge(args);
      } catch (e) {
        if (e instanceof Error && e.message.includes(NO_KEY_MESSAGE)) openKeyDialog();
        throw e;
      }
    }) as ForgeCall,
    [forge, apiKey, builtIn, openKeyDialog],
  );
}
