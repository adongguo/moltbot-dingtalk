import type { DingTalkIdType } from "./types.js";

// DingTalk uses different ID formats
const CONVERSATION_ID_PREFIX = "cid";

export function detectIdType(id: string): DingTalkIdType | null {
  const trimmed = id.trim();
  if (trimmed.startsWith(CONVERSATION_ID_PREFIX)) return "chatId";
  // DingTalk staffId is typically a numeric string
  if (/^\d+$/.test(trimmed)) return "staffId";
  return null;
}

export function normalizeDingTalkTarget(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const lowered = trimmed.toLowerCase();
  if (lowered.startsWith("chat:")) {
    return trimmed.slice("chat:".length).trim() || null;
  }
  if (lowered.startsWith("user:")) {
    return trimmed.slice("user:".length).trim() || null;
  }
  if (lowered.startsWith("staff:")) {
    return trimmed.slice("staff:".length).trim() || null;
  }

  return trimmed;
}

export function formatDingTalkTarget(id: string, type?: DingTalkIdType): string {
  const trimmed = id.trim();
  if (type === "chatId" || trimmed.startsWith(CONVERSATION_ID_PREFIX)) {
    return `chat:${trimmed}`;
  }
  if (type === "staffId") {
    return `user:${trimmed}`;
  }
  return trimmed;
}

export function looksLikeDingTalkId(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (/^(chat|user|staff):/i.test(trimmed)) return true;
  if (trimmed.startsWith(CONVERSATION_ID_PREFIX)) return true;
  // DingTalk IDs are typically alphanumeric
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) return true;
  return false;
}

// Not used in DingTalk (sessionWebhook-based), but kept for compatibility
export function resolveReceiveIdType(_id: string): "chatId" | "staffId" {
  return "chatId";
}
