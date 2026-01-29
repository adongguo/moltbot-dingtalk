import type { DingTalkConfigSchema, DingTalkGroupSchema, z } from "./config-schema.js";

export type DingTalkConfig = z.infer<typeof DingTalkConfigSchema>;
export type DingTalkGroupConfig = z.infer<typeof DingTalkGroupSchema>;

export type DingTalkConnectionMode = "stream" | "webhook";

export type ResolvedDingTalkAccount = {
  accountId: string;
  enabled: boolean;
  configured: boolean;
  appKey?: string;
  robotCode?: string;
};

export type DingTalkIdType = "staffId" | "odpsUserId" | "chatId";

export type DingTalkMessageContext = {
  conversationId: string;
  messageId: string;
  senderId: string; // senderStaffId
  senderNick?: string;
  chatType: "p2p" | "group"; // 1 = single chat, 2 = group chat
  mentionedBot: boolean;
  sessionWebhook: string;
  sessionWebhookExpiredTime?: number;
  content: string;
  contentType: string; // text, image, voice, file, link, markdown, action_card
  robotCode?: string;
  chatbotCorpId?: string;
  isAdmin?: boolean;
};

export type DingTalkSendResult = {
  messageId?: string;
  conversationId: string;
  processQueryKey?: string;
};

export type DingTalkProbeResult = {
  ok: boolean;
  error?: string;
  appKey?: string;
  robotCode?: string;
  connected?: boolean;
};

export type DingTalkMediaInfo = {
  path: string;
  contentType?: string;
  placeholder: string;
};

// DingTalk incoming message structure (from Stream callback)
export type DingTalkIncomingMessage = {
  msgId: string;
  msgtype: "text" | "image" | "voice" | "file" | "link" | "markdown" | "richText" | "picture";
  text?: { content: string };
  content?: string; // For richText
  conversationId: string;
  conversationType: "1" | "2"; // 1 = single chat, 2 = group chat
  chatbotCorpId: string;
  chatbotUserId?: string;
  senderNick: string;
  senderStaffId?: string;
  senderCorpId?: string;
  sessionWebhook: string;
  sessionWebhookExpiredTime: number;
  createAt: number;
  robotCode?: string;
  atUsers?: Array<{
    dingtalkId: string;
    staffId?: string;
  }>;
  isAdmin?: boolean;
  isInAtList?: boolean;
  // For media messages
  downloadCode?: string;
};

// DingTalk outbound message types
export type DingTalkTextMessage = {
  msgtype: "text";
  text: {
    content: string;
  };
  at?: {
    atUserIds?: string[];
    atMobiles?: string[];
    isAtAll?: boolean;
  };
};

export type DingTalkMarkdownMessage = {
  msgtype: "markdown";
  markdown: {
    title: string;
    text: string;
  };
  at?: {
    atUserIds?: string[];
    atMobiles?: string[];
    isAtAll?: boolean;
  };
};

export type DingTalkActionCardMessage = {
  msgtype: "actionCard";
  actionCard: {
    title: string;
    text: string;
    singleTitle?: string;
    singleURL?: string;
    btnOrientation?: "0" | "1";
    btns?: Array<{
      title: string;
      actionURL: string;
    }>;
  };
};

export type DingTalkLinkMessage = {
  msgtype: "link";
  link: {
    title: string;
    text: string;
    messageUrl: string;
    picUrl?: string;
  };
};

export type DingTalkOutboundMessage =
  | DingTalkTextMessage
  | DingTalkMarkdownMessage
  | DingTalkActionCardMessage
  | DingTalkLinkMessage;
