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
}): ProviderChoice | null {
  const user = env.userKey?.trim();
  if (user) {
    return { via: isGeminiKey(user) ? "gemini" : "anthropic", key: user, ownerPays: false };
  }
  const server = env.serverAnthropicKey?.trim();
  if (server) return { via: "anthropic", key: server, ownerPays: true };
  const serverGemini = env.serverGeminiKey?.trim();
  if (serverGemini) return { via: "gemini", key: serverGemini, ownerPays: true };
  const gateway = env.gatewayKey?.trim();
  if (gateway) return { via: "gateway", key: gateway, ownerPays: true };
  return null;
}
