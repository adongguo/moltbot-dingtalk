import type { ClawdbotConfig } from "clawdbot/plugin-sdk";
import type { DWClient } from "dingtalk-stream";
import type {
  DingTalkConfig,
  DingTalkSendResult,
  DingTalkTextMessage,
  DingTalkMarkdownMessage,
  DingTalkActionCardMessage,
  DingTalkOutboundMessage,
} from "./types.js";
import { getDingTalkRuntime } from "./runtime.js";

export type DingTalkMessageInfo = {
  messageId: string;
  conversationId: string;
  senderId?: string;
  content: string;
  contentType: string;
  createTime?: number;
};

/**
 * Send a message via DingTalk sessionWebhook.
 * This is the primary method for sending messages in response to incoming messages.
 */
export async function sendViaWebhook(params: {
  sessionWebhook: string;
  message: DingTalkOutboundMessage;
  accessToken?: string;
}): Promise<DingTalkSendResult> {
  const { sessionWebhook, message, accessToken } = params;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (accessToken) {
    headers["x-acs-dingtalk-access-token"] = accessToken;
  }

  const response = await fetch(sessionWebhook, {
    method: "POST",
    headers,
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`DingTalk webhook send failed: ${response.status} ${text}`);
  }

  const result = await response.json() as { errcode?: number; errmsg?: string; processQueryKey?: string };

  if (result.errcode && result.errcode !== 0) {
    throw new Error(`DingTalk send failed: ${result.errmsg || `code ${result.errcode}`}`);
  }

  return {
    conversationId: "",
    processQueryKey: result.processQueryKey,
  };
}

export type SendDingTalkMessageParams = {
  cfg: ClawdbotConfig;
  sessionWebhook: string;
  text: string;
  atUserIds?: string[];
  client?: DWClient;
};

export async function sendMessageDingTalk(params: SendDingTalkMessageParams): Promise<DingTalkSendResult> {
  const { cfg, sessionWebhook, text, atUserIds, client } = params;
  const dingtalkCfg = cfg.channels?.dingtalk as DingTalkConfig | undefined;
  if (!dingtalkCfg) {
    throw new Error("DingTalk channel not configured");
  }

  const tableMode = getDingTalkRuntime().channel.text.resolveMarkdownTableMode({
    cfg,
    channel: "dingtalk",
  });
  const messageText = getDingTalkRuntime().channel.text.convertMarkdownTables(text ?? "", tableMode);

  const message: DingTalkTextMessage = {
    msgtype: "text",
    text: {
      content: messageText,
    },
  };

  if (atUserIds && atUserIds.length > 0) {
    message.at = {
      atUserIds,
      isAtAll: false,
    };
  }

  let accessToken: string | undefined;
  if (client) {
    try {
      accessToken = await client.getAccessToken();
    } catch {
      // Proceed without access token
    }
  }

  return sendViaWebhook({ sessionWebhook, message, accessToken });
}

export type SendDingTalkMarkdownParams = {
  cfg: ClawdbotConfig;
  sessionWebhook: string;
  title: string;
  text: string;
  atUserIds?: string[];
  client?: DWClient;
};

export async function sendMarkdownDingTalk(params: SendDingTalkMarkdownParams): Promise<DingTalkSendResult> {
  const { sessionWebhook, title, text, atUserIds, client } = params;

  const message: DingTalkMarkdownMessage = {
    msgtype: "markdown",
    markdown: {
      title,
      text,
    },
  };

  if (atUserIds && atUserIds.length > 0) {
    message.at = {
      atUserIds,
      isAtAll: false,
    };
  }

  let accessToken: string | undefined;
  if (client) {
    try {
      accessToken = await client.getAccessToken();
    } catch {
      // Proceed without access token
    }
  }

  return sendViaWebhook({ sessionWebhook, message, accessToken });
}

export type SendDingTalkActionCardParams = {
  cfg: ClawdbotConfig;
  sessionWebhook: string;
  title: string;
  text: string;
  singleTitle?: string;
  singleURL?: string;
  client?: DWClient;
};

export async function sendActionCardDingTalk(params: SendDingTalkActionCardParams): Promise<DingTalkSendResult> {
  const { sessionWebhook, title, text, singleTitle, singleURL, client } = params;

  const message: DingTalkActionCardMessage = {
    msgtype: "actionCard",
    actionCard: {
      title,
      text,
      singleTitle,
      singleURL,
    },
  };

  let accessToken: string | undefined;
  if (client) {
    try {
      accessToken = await client.getAccessToken();
    } catch {
      // Proceed without access token
    }
  }

  return sendViaWebhook({ sessionWebhook, message, accessToken });
}

/**
 * Build an ActionCard message with markdown content.
 * ActionCards render markdown properly (code blocks, tables, links, etc.)
 */
export function buildMarkdownCard(text: string, title?: string): DingTalkActionCardMessage {
  return {
    msgtype: "actionCard",
    actionCard: {
      title: title || "Message",
      text,
    },
  };
}

/**
 * Send a message as an ActionCard (for better markdown rendering).
 */
export async function sendMarkdownCardDingTalk(params: {
  cfg: ClawdbotConfig;
  sessionWebhook: string;
  text: string;
  title?: string;
  client?: DWClient;
}): Promise<DingTalkSendResult> {
  const { cfg, sessionWebhook, text, title, client } = params;
  const message = buildMarkdownCard(text, title);

  let accessToken: string | undefined;
  if (client) {
    try {
      accessToken = await client.getAccessToken();
    } catch {
      // Proceed without access token
    }
  }

  return sendViaWebhook({ sessionWebhook, message, accessToken });
}
