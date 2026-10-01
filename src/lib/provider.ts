/**
 * Which AI backend serves a request. An explicit key always beats an implicit one:
 *   1. the caller's own Anthropic key (their credits),
 *   2. ANTHROPIC_API_KEY set on the server (the owner's credits, works on any host),
 *   3. Lovable's built-in gateway (only exists while hosted on Lovable).
 * Callers who bring their own key are not rate-limited; the other two are the owner's money.
 */
export type ProviderChoice = {
  via: "anthropic" | "gateway";
  key: string;
  /** True when the owner pays, so sign-in and the hourly limit apply. */
  ownerPays: boolean;
};

export function chooseProvider(env: {
  userKey?: string | undefined;
  serverAnthropicKey?: string | undefined;
  gatewayKey?: string | undefined;
}): ProviderChoice | null {
  const user = env.userKey?.trim();
  if (user) return { via: "anthropic", key: user, ownerPays: false };
  const server = env.serverAnthropicKey?.trim();
  if (server) return { via: "anthropic", key: server, ownerPays: true };
  const gateway = env.gatewayKey?.trim();
  if (gateway) return { via: "gateway", key: gateway, ownerPays: true };
  return null;
}
