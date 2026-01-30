import type { ClawdbotConfig } from "openclaw/plugin-sdk";

// DingTalk doesn't have a native typing indicator API
// This is a stub implementation that does nothing but maintains interface compatibility

export type TypingIndicatorState = {
  sessionWebhook?: string;
  active: boolean;
};

/**
 * Add a typing indicator (stub - DingTalk doesn't support this)
 */
export async function addTypingIndicator(params: {
  cfg: ClawdbotConfig;
  sessionWebhook?: string;
}): Promise<TypingIndicatorState> {
  // DingTalk doesn't support typing indicators
  // Just return a state object for tracking
  return {
    sessionWebhook: params.sessionWebhook,
    active: true,
  };
}

/**
 * Remove a typing indicator (stub - DingTalk doesn't support this)
 */
export async function removeTypingIndicator(params: {
  cfg: ClawdbotConfig;
  state: TypingIndicatorState;
}): Promise<void> {
  // DingTalk doesn't support typing indicators
  // Nothing to do here
  params.state.active = false;
}
