import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Routing = "fast" | "craft";

type Settings = {
  apiKey: string;
  setApiKey: (v: string) => void;
  routing: Routing;
  setRouting: (v: Routing) => void;
};

const SettingsContext = createContext<Settings | null>(null);

const KEY_STORE = "blf.anthropic.key";
const ROUTE_STORE = "blf.routing";

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKey] = useState("");
  const [routing, setRouting] = useState<Routing>("fast");

  // Session-only: read after hydration so SSR markup stays stable.
  useEffect(() => {
    try {
      const k = sessionStorage.getItem(KEY_STORE);
      if (k) setApiKey(k);
      const r = sessionStorage.getItem(ROUTE_STORE);
      if (r === "fast" || r === "craft") setRouting(r);
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    try {
      if (apiKey) sessionStorage.setItem(KEY_STORE, apiKey);
      else sessionStorage.removeItem(KEY_STORE);
    } catch {
      /* storage unavailable */
    }
  }, [apiKey]);

  useEffect(() => {
    try {
      sessionStorage.setItem(ROUTE_STORE, routing);
    } catch {
      /* storage unavailable */
    }
  }, [routing]);

  const value = useMemo(
    () => ({ apiKey, setApiKey, routing, setRouting }),
    [apiKey, routing],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
