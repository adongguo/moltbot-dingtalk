import type { ClawdbotConfig } from "openclaw/plugin-sdk";

// DingTalk doesn't have a message reactions API
// This module provides stub implementations for interface compatibility

export type DingTalkReaction = {
  reactionId: string;
  emojiType: string;
  operatorType: "app" | "user";
  operatorId: string;
};

/**
 * Add a reaction (emoji) to a message.
 * Note: DingTalk doesn't support message reactions via bot API.
 */
export async function addReactionDingTalk(_params: {
  cfg: ClawdbotConfig;
  messageId: string;
  emojiType: string;
}): Promise<{ reactionId: string }> {
  // DingTalk doesn't support message reactions via bot API
  throw new Error("DingTalk does not support message reactions via bot API");
}

/**
 * Remove a reaction from a message.
 * Note: DingTalk doesn't support message reactions via bot API.
 */
export async function removeReactionDingTalk(_params: {
  cfg: ClawdbotConfig;
  messageId: string;
  reactionId: string;
}): Promise<void> {
  // DingTalk doesn't support message reactions via bot API
  throw new Error("DingTalk does not support message reactions via bot API");
}

/**
 * List all reactions for a message.
 * Note: DingTalk doesn't support message reactions via bot API.
 */
export async function listReactionsDingTalk(_params: {
  cfg: ClawdbotConfig;
  messageId: string;
  emojiType?: string;
}): Promise<DingTalkReaction[]> {
  // DingTalk doesn't support message reactions via bot API
  return [];
}

/**
 * Common emoji types for convenience.
 * Note: These are placeholders since DingTalk doesn't support reactions.
 */
export const DingTalkEmoji = {
  THUMBSUP: "THUMBSUP",
  THUMBSDOWN: "THUMBSDOWN",
  HEART: "HEART",
  SMILE: "SMILE",
  OK: "OK",
} as const;

export type DingTalkEmojiType = (typeof DingTalkEmoji)[keyof typeof DingTalkEmoji];
