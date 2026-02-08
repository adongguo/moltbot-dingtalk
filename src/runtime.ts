import type { PluginRuntime } from "openclaw/plugin-sdk";

let runtime: PluginRuntime | null = null;

export function setDingTalkRuntime(next: PluginRuntime) {
  runtime = next;
}

export function getDingTalkRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("DingTalk runtime not initialized");
  }
  return runtime;
}

// ── Session Webhook Cache ──
// Stores the latest sessionWebhook per conversationId so agent tools
// (which don't receive webhook context) can send messages.

const webhookCache = new Map<string, { url: string; expiresAt: number }>();

/** Cache a sessionWebhook (called from bot.ts on each incoming message). */
export function cacheSessionWebhook(conversationId: string, url: string, expiresAt?: number) {
  webhookCache.set(conversationId, {
    url,
    expiresAt: expiresAt ?? Date.now() + 3600_000,
  });
}

/** Get the latest cached webhook for a conversation, or the most recent one. */
export function getCachedWebhook(conversationId?: string): string | undefined {
  const now = Date.now();
  if (conversationId) {
    const entry = webhookCache.get(conversationId);
    if (entry && entry.expiresAt > now) return entry.url;
  }
  // Fallback: return most recent non-expired webhook
  let best: { url: string; expiresAt: number } | undefined;
  for (const entry of webhookCache.values()) {
    if (entry.expiresAt > now && (!best || entry.expiresAt > best.expiresAt)) {
      best = entry;
    }
  }
  return best?.url;
}
