import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { getAiConfig } from "@/lib/forge.functions";
import { track } from "@/lib/stats";

export type Routing = "fast" | "craft";

type Settings = {
  apiKey: string;
  setApiKey: (v: string) => void;
  routing: Routing;
  setRouting: (v: Routing) => void;
  /** Keep the key in this browser between visits (localStorage) instead of this tab only. */
  remember: boolean;
  setRemember: (v: boolean) => void;
  /** True when the server offers a built-in model, so a key is optional. False = own-key mode. */
  builtIn: boolean;
  /** True when AI tools can run right now (own key set, or a built-in model exists). */
  aiReady: boolean;
  keyDialogOpen: boolean;
  openKeyDialog: () => void;
  setKeyDialogOpen: (v: boolean) => void;
};

const SettingsContext = createContext<Settings | null>(null);

const KEY_STORE = "blf.anthropic.key";
const ROUTE_STORE = "blf.routing";
const REMEMBER_STORE = "blf.key.remember";

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKey] = useState("");
  const [routing, setRouting] = useState<Routing>("fast");
  const [remember, setRemember] = useState(false);
  const [builtIn, setBuiltIn] = useState(false);
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Read after hydration so SSR markup stays stable.
  useEffect(() => {
    try {
      const remembered = localStorage.getItem(REMEMBER_STORE) === "1";
      setRemember(remembered);
      const k = (remembered ? localStorage.getItem(KEY_STORE) : null) ?? sessionStorage.getItem(KEY_STORE);
      if (k) setApiKey(k);
      const r = sessionStorage.getItem(ROUTE_STORE);
      if (r === "fast" || r === "craft") setRouting(r);
    } catch {
      /* storage unavailable */
    }
    setLoaded(true);
    getAiConfig()
      .then((c) => setBuiltIn(c.builtIn))
      .catch(() => setBuiltIn(false));
  }, []);

  // The key lives in this tab only, unless the person chose "Remember on this device".
  useEffect(() => {
    if (!loaded) return;
    try {
      if (remember) {
        localStorage.setItem(REMEMBER_STORE, "1");
        if (apiKey) localStorage.setItem(KEY_STORE, apiKey);
        else localStorage.removeItem(KEY_STORE);
        sessionStorage.removeItem(KEY_STORE);
      } else {
        localStorage.removeItem(REMEMBER_STORE);
        localStorage.removeItem(KEY_STORE);
        if (apiKey) sessionStorage.setItem(KEY_STORE, apiKey);
        else sessionStorage.removeItem(KEY_STORE);
      }
    } catch {
      /* storage unavailable */
    }
  }, [apiKey, remember, loaded]);

  useEffect(() => {
    try {
      sessionStorage.setItem(ROUTE_STORE, routing);
    } catch {
      /* storage unavailable */
    }
  }, [routing]);

  const openKeyDialog = useCallback(() => {
    track("key_dialog_open");
    setKeyDialogOpen(true);
  }, []);
  const aiReady = builtIn || apiKey.trim().length > 0;

  const value = useMemo(
    () => ({
      apiKey,
      setApiKey,
      routing,
      setRouting,
      remember,
      setRemember,
      builtIn,
      aiReady,
      keyDialogOpen,
      openKeyDialog,
      setKeyDialogOpen,
    }),
    [apiKey, routing, remember, builtIn, aiReady, keyDialogOpen, openKeyDialog],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
