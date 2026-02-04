import type { ChannelOutboundAdapter } from "openclaw/plugin-sdk";
import type { DingTalkConfig } from "./types.js";
import { getDingTalkRuntime } from "./runtime.js";
import { sendMessageDingTalk } from "./send.js";
import { sendMediaDingTalk } from "./media.js";
import { sendTextViaOpenAPI, sendImageViaOpenAPI, type OpenAPISendTarget } from "./openapi-send.js";

export type OutboundTarget =
  | { kind: "webhook"; url: string }
  | { kind: "user"; id: string }
  | { kind: "group"; id: string };

export const dingtalkOutbound: ChannelOutboundAdapter = {
  deliveryMode: "direct",
  chunker: (text, limit) => getDingTalkRuntime().channel.text.chunkMarkdownText(text, limit),
  chunkerMode: "markdown",
  textChunkLimit: 4000,
  sendText: async ({ cfg, to, text }) => {
    const target = parseOutboundTarget(to);

    if (target.kind === "webhook") {
      const result = await sendMessageDingTalk({ cfg, sessionWebhook: target.url, text });
      return { channel: "dingtalk", conversationId: result.conversationId, messageId: result.processQueryKey || "" };
    }

    const dingtalkCfg = cfg.channels?.dingtalk as DingTalkConfig | undefined;
    if (!dingtalkCfg?.appKey || !dingtalkCfg?.appSecret) {
      throw new Error("[dingtalk] appKey/appSecret required for proactive send");
    }

    const openAPITarget: OpenAPISendTarget = { kind: target.kind, id: target.id };
    const result = await sendTextViaOpenAPI({ config: dingtalkCfg, target: openAPITarget, content: text });
    return { channel: "dingtalk", conversationId: "", messageId: result.processQueryKey };
  },
  sendMedia: async ({ cfg, to, text, mediaUrl }) => {
    const target = parseOutboundTarget(to);

    if (target.kind === "webhook") {
      if (text?.trim()) {
        await sendMessageDingTalk({ cfg, sessionWebhook: target.url, text });
      }

      if (mediaUrl) {
        try {
          const result = await sendMediaDingTalk({ cfg, sessionWebhook: target.url, mediaUrl });
          return { channel: "dingtalk", conversationId: result.conversationId, messageId: result.processQueryKey || "" };
        } catch (err) {
          // Fallback: upload failed, send URL as link
          const fallbackText = `📎 ${mediaUrl}`;
          const result = await sendMessageDingTalk({ cfg, sessionWebhook: target.url, text: fallbackText });
          return { channel: "dingtalk", conversationId: result.conversationId, messageId: result.processQueryKey || "" };
        }
      }

      const result = await sendMessageDingTalk({ cfg, sessionWebhook: target.url, text: text ?? "" });
      return { channel: "dingtalk", conversationId: result.conversationId, messageId: result.processQueryKey || "" };
    }

    const dingtalkCfg = cfg.channels?.dingtalk as DingTalkConfig | undefined;
    if (!dingtalkCfg?.appKey || !dingtalkCfg?.appSecret) {
      throw new Error("[dingtalk] appKey/appSecret required for proactive send");
    }

    const openAPITarget: OpenAPISendTarget = { kind: target.kind, id: target.id };

    if (text?.trim()) {
      await sendTextViaOpenAPI({ config: dingtalkCfg, target: openAPITarget, content: text });
    }

    if (mediaUrl) {
      try {
        const result = await sendImageViaOpenAPI({ config: dingtalkCfg, target: openAPITarget, photoURL: mediaUrl });
        return { channel: "dingtalk", conversationId: "", messageId: result.processQueryKey };
      } catch (err) {
        // Fallback: image upload failed, send URL as link
        const fallbackText = `📎 ${mediaUrl}`;
        const result = await sendTextViaOpenAPI({ config: dingtalkCfg, target: openAPITarget, content: fallbackText });
        return { channel: "dingtalk", conversationId: "", messageId: result.processQueryKey };
      }
    }

    if (!text?.trim()) {
      const result = await sendTextViaOpenAPI({ config: dingtalkCfg, target: openAPITarget, content: text ?? "" });
      return { channel: "dingtalk", conversationId: "", messageId: result.processQueryKey };
    }

    return { channel: "dingtalk", conversationId: "", messageId: "" };
  },
};

// ============ Private Helpers ============

function parseOutboundTarget(to: string): OutboundTarget {
  if (to.startsWith("https://") || to.startsWith("http://")) {
    return { kind: "webhook", url: to };
  }

  const userMatch = to.match(/^(?:user|staff):(.+)$/i);
  if (userMatch) {
    return { kind: "user", id: userMatch[1] };
  }

  const groupMatch = to.match(/^(?:group|chat):(.+)$/i);
  if (groupMatch) {
    return { kind: "group", id: groupMatch[1] };
  }

  if (to.startsWith("cid")) {
    return { kind: "group", id: to };
  }

  // Bare ID without prefix: webhook URLs always start with http(s)://,
  // group conversationIds start with "cid", so anything else is a staffId.
  return { kind: "user", id: to };
}
