import { DWClient, TOPIC_ROBOT } from "dingtalk-stream";
import type { ClawdbotConfig, RuntimeEnv, HistoryEntry } from "openclaw/plugin-sdk";
import type { DingTalkConfig, DingTalkIncomingMessage } from "./types.js";
import { createDingTalkClient } from "./client.js";
import { resolveDingTalkCredentials } from "./accounts.js";
import { handleDingTalkMessage } from "./bot.js";
import { cleanupExpiredSessions, DEFAULT_SESSION_TIMEOUT } from "./session.js";

export type MonitorDingTalkOpts = {
  config?: ClawdbotConfig;
  runtime?: RuntimeEnv;
  abortSignal?: AbortSignal;
  accountId?: string;
};

let currentClient: DWClient | null = null;
let cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

export async function monitorDingTalkProvider(opts: MonitorDingTalkOpts = {}): Promise<void> {
  const cfg = opts.config;
  if (!cfg) {
    throw new Error("Config is required for DingTalk monitor");
  }

  const dingtalkCfg = cfg.channels?.dingtalk as DingTalkConfig | undefined;
  const creds = resolveDingTalkCredentials(dingtalkCfg);
  if (!creds) {
    throw new Error("DingTalk credentials not configured (appKey, appSecret required)");
  }

  const log = opts.runtime?.log ?? console.log;

  const connectionMode = dingtalkCfg?.connectionMode ?? "stream";

  if (connectionMode === "stream") {
    return monitorStream({ cfg, dingtalkCfg: dingtalkCfg!, runtime: opts.runtime, abortSignal: opts.abortSignal });
  }

  log("dingtalk: webhook mode not implemented in monitor, use HTTP server directly");
}

async function monitorStream(params: {
  cfg: ClawdbotConfig;
  dingtalkCfg: DingTalkConfig;
  runtime?: RuntimeEnv;
  abortSignal?: AbortSignal;
}): Promise<void> {
  const { cfg, dingtalkCfg, runtime, abortSignal } = params;
  const log = runtime?.log ?? console.log;
  const error = runtime?.error ?? console.error;

  log("dingtalk: starting Stream connection...");

  const client = createDingTalkClient(dingtalkCfg);
  currentClient = client;

  const chatHistories = new Map<string, HistoryEntry[]>();

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      if (cleanupIntervalId) {
        clearInterval(cleanupIntervalId);
        cleanupIntervalId = null;
      }
      if (currentClient === client) {
        try {
          client.disconnect();
        } catch {
          // Ignore disconnect errors
        }
        currentClient = null;
      }
    };

    const handleAbort = () => {
      log("dingtalk: abort signal received, stopping Stream client");
      cleanup();
      resolve();
    };

    if (abortSignal?.aborted) {
      cleanup();
      resolve();
      return;
    }

    abortSignal?.addEventListener("abort", handleAbort, { once: true });

    try {
      // Register callback listener for robot messages
      client.registerCallbackListener(TOPIC_ROBOT, async (res) => {
        try {
          const messageData = JSON.parse(res.data) as DingTalkIncomingMessage;

          // DingTalk nests downloadCode inside `content` for media messages (picture, file, voice, video).
          // Extract to top level for consistent access by downstream handlers.
          if (!messageData.downloadCode && messageData.content && typeof messageData.content === "object") {
            const contentObj = messageData.content as unknown as Record<string, unknown>;
            if (typeof contentObj.downloadCode === "string") {
              (messageData as Record<string, unknown>).downloadCode = contentObj.downloadCode;
            }
          }

          log(`dingtalk: received message from ${messageData.senderNick}: ${messageData.text?.content || messageData.msgtype}`);

          await handleDingTalkMessage({
            cfg,
            message: messageData,
            runtime,
            chatHistories,
            client,
          });

          // Acknowledge the message
          client.socketCallBackResponse(res.headers.messageId, { success: true });
        } catch (err) {
          error(`dingtalk: error handling message: ${String(err)}`);
          // Still acknowledge to prevent redelivery
          client.socketCallBackResponse(res.headers.messageId, { success: false, error: String(err) });
        }
      });

      // Connect to DingTalk Stream
      client.connect();
      log("dingtalk: Stream client connected");

      // Periodic cleanup of expired sessions (every 5 minutes)
      const sessionTimeout = dingtalkCfg.sessionTimeout ?? DEFAULT_SESSION_TIMEOUT;
      cleanupIntervalId = setInterval(() => {
        const cleaned = cleanupExpiredSessions(sessionTimeout);
        if (cleaned > 0) {
          log(`dingtalk: cleaned up ${cleaned} expired sessions`);
        }
      }, 300_000);
    } catch (err) {
      cleanup();
      abortSignal?.removeEventListener("abort", handleAbort);
      reject(err);
    }
  });
}

export function stopDingTalkMonitor(): void {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
  if (currentClient) {
    try {
      currentClient.disconnect();
    } catch {
      // Ignore errors
    }
    currentClient = null;
  }
}
