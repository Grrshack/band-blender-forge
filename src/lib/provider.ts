/**
 * Which AI backend serves a request. An explicit key always beats an implicit one:
 *   1. the caller's own key (their credits): an Anthropic key (sk-ant-...) or a Google AI Studio key,
 *   2. ANTHROPIC_API_KEY set on the server (the owner's credits, works on any host),
 *   3. GEMINI_API_KEY set on the server (the owner's free-tier quota),
 *   4. Lovable's built-in gateway (only exists while hosted on Lovable).
 * Callers who bring their own key are not rate-limited; the others are the owner's quota.
 */
export type ProviderVia = "anthropic" | "gemini" | "gateway";

export type ProviderChoice = {
  via: ProviderVia;
  key: string;
  /** True when the owner pays or supplies the quota, so sign-in and the hourly limit apply. */
  ownerPays: boolean;
};

/**
 * Anthropic keys start with "sk-". Anything else is treated as a Google key: AI Studio keys
 * have used different prefixes ("AIza…", and newer "AQ.…" authorization keys).
 */
export function isGeminiKey(key: string): boolean {
  return !key.startsWith("sk-");
}

export function chooseProvider(env: {
  userKey?: string | undefined;
  serverAnthropicKey?: string | undefined;
  serverGeminiKey?: string | undefined;
  gatewayKey?: string | undefined;
  /**
   * When false, only the caller's own key is ever used: the owner's keys and Lovable's
   * gateway are ignored even if they are configured. Defaults to true for backwards
   * compatibility; the live server passes isBuiltInAiAllowed().
   */
  allowBuiltIn?: boolean | undefined;
}): ProviderChoice | null {
  const user = env.userKey?.trim();
  if (user) {
    return { via: isGeminiKey(user) ? "gemini" : "anthropic", key: user, ownerPays: false };
  }
  if (env.allowBuiltIn === false) return null;
  const server = env.serverAnthropicKey?.trim();
  if (server) return { via: "anthropic", key: server, ownerPays: true };
  const serverGemini = env.serverGeminiKey?.trim();
  if (serverGemini) return { via: "gemini", key: serverGemini, ownerPays: true };
  const gateway = env.gatewayKey?.trim();
  if (gateway) return { via: "gateway", key: gateway, ownerPays: true };
  return null;
}

/**
 * Own-key mode is the default: the site owner's keys are only used when the server
 * explicitly sets ALLOW_BUILT_IN_AI=true. Without it, every visitor must bring a key.
 */
export function isBuiltInAiAllowed(env: Record<string, string | undefined>): boolean {
  return env["ALLOW_BUILT_IN_AI"] === "true";
}

/** Shown (and matched on the client) when an AI call arrives without a key in own-key mode. */
export const NO_KEY_MESSAGE =
  "Add your AI key to use this tool. A free Google Gemini key takes about a minute to get.";

/** Human-readable provider name for a key, used in the UI. */
export function providerLabel(key: string): "Google Gemini" | "Anthropic" {
  return isGeminiKey(key.trim()) ? "Google Gemini" : "Anthropic";
}
