/**
 * Session Management for DingTalk
 *
 * Handles session timeout and new session commands.
 * Provides session key generation for conversation persistence.
 */

// ============ Types ============

export interface UserSession {
  lastActivity: number;
  sessionId: string; // Format: dingtalk:<senderId> or dingtalk:<senderId>:<timestamp>
}

interface Logger {
  info?: (msg: string) => void;
  warn?: (msg: string) => void;
  error?: (msg: string) => void;
}

// ============ Constants ============

/** Commands that trigger a new session */
const NEW_SESSION_COMMANDS = ["/new", "/reset", "/clear", "新会话", "重新开始", "清空对话"];

/** Default session timeout: 30 minutes */
export const DEFAULT_SESSION_TIMEOUT = 1800000;

// ============ Session Storage ============

/** User session cache Map<senderId, UserSession> */
const userSessions = new Map<string, UserSession>();

// ============ Functions ============

/**
 * Check if a message is a new session command.
 */
export function isNewSessionCommand(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  return NEW_SESSION_COMMANDS.some((cmd) => trimmed === cmd.toLowerCase());
}

/**
 * Get list of new session commands for display purposes.
 */
export function getNewSessionCommands(): readonly string[] {
  return NEW_SESSION_COMMANDS;
}

/**
 * Get or create a session key for a user.
 *
 * @param senderId - The sender's ID
 * @param forceNew - Force creation of a new session
 * @param sessionTimeout - Session timeout in milliseconds
 * @param log - Optional logger
 * @returns Session key and whether it's a new session
 */
export function getSessionKey(
  senderId: string,
  forceNew: boolean,
  sessionTimeout: number,
  log?: Logger,
): { sessionKey: string; isNew: boolean } {
  const now = Date.now();
  const existing = userSessions.get(senderId);

  // Force new session
  if (forceNew) {
    const sessionId = `dingtalk:${senderId}:${now}`;
    userSessions.set(senderId, { lastActivity: now, sessionId });
    log?.info?.(`[DingTalk][Session] User requested new session: ${senderId}`);
    return { sessionKey: sessionId, isNew: true };
  }

  // Check timeout
  if (existing) {
    const elapsed = now - existing.lastActivity;
    if (elapsed > sessionTimeout) {
      const sessionId = `dingtalk:${senderId}:${now}`;
      userSessions.set(senderId, { lastActivity: now, sessionId });
      log?.info?.(
        `[DingTalk][Session] Session timeout (${Math.round(elapsed / 60000)} min), auto new session: ${senderId}`,
      );
      return { sessionKey: sessionId, isNew: true };
    }
    // Update activity time (immutable)
    userSessions.set(senderId, { ...existing, lastActivity: now });
    return { sessionKey: existing.sessionId, isNew: false };
  }

  // First session
  const sessionId = `dingtalk:${senderId}`;
  userSessions.set(senderId, { lastActivity: now, sessionId });
  log?.info?.(`[DingTalk][Session] New user first session: ${senderId}`);
  return { sessionKey: sessionId, isNew: false };
}

/**
 * Clear a user's session.
 */
export function clearSession(senderId: string): void {
  userSessions.delete(senderId);
}

/**
 * Get session info for a user (for debugging).
 */
export function getSessionInfo(senderId: string): UserSession | undefined {
  return userSessions.get(senderId);
}

/**
 * Clear all sessions (for testing or reset).
 */
export function clearAllSessions(): void {
  userSessions.clear();
}

/**
 * Get the number of active sessions.
 */
export function getActiveSessionCount(): number {
  return userSessions.size;
}

/**
 * Clean up expired sessions.
 * Call this periodically to prevent memory leaks.
 */
export function cleanupExpiredSessions(sessionTimeout: number): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [senderId, session] of userSessions.entries()) {
    if (now - session.lastActivity > sessionTimeout) {
      userSessions.delete(senderId);
      cleaned++;
    }
  }

  return cleaned;
}
