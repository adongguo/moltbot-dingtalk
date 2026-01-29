import type { ChannelOutboundAdapter } from "clawdbot/plugin-sdk";
import { getDingTalkRuntime } from "./runtime.js";
import { sendMessageDingTalk } from "./send.js";
import { sendMediaDingTalk } from "./media.js";

// Note: DingTalk outbound adapter has limited functionality
// because it requires sessionWebhook which is only available during message handling.
// This adapter is primarily for interface compatibility.

export const dingtalkOutbound: ChannelOutboundAdapter = {
  deliveryMode: "direct",
  chunker: (text, limit) => getDingTalkRuntime().channel.text.chunkMarkdownText(text, limit),
  chunkerMode: "markdown",
  textChunkLimit: 4000,
  sendText: async ({ cfg, to, text }) => {
    // Note: DingTalk requires sessionWebhook, which must be provided in the 'to' field
    // Format: sessionWebhook URL directly
    const result = await sendMessageDingTalk({ cfg, sessionWebhook: to, text });
    return { channel: "dingtalk", conversationId: result.conversationId, messageId: result.processQueryKey || "" };
  },
  sendMedia: async ({ cfg, to, text, mediaUrl }) => {
    // Send text first if provided
    if (text?.trim()) {
      await sendMessageDingTalk({ cfg, sessionWebhook: to, text });
    }

    // Upload and send media if URL provided
    if (mediaUrl) {
      try {
        const result = await sendMediaDingTalk({ cfg, sessionWebhook: to, mediaUrl });
        return { channel: "dingtalk", conversationId: result.conversationId, messageId: result.processQueryKey || "" };
      } catch (err) {
        // Log the error for debugging
        console.error(`[dingtalk] sendMediaDingTalk failed:`, err);
        // Fallback to URL link if upload fails
        const fallbackText = `📎 ${mediaUrl}`;
        const result = await sendMessageDingTalk({ cfg, sessionWebhook: to, text: fallbackText });
        return { channel: "dingtalk", conversationId: result.conversationId, messageId: result.processQueryKey || "" };
      }
    }

    // No media URL, just return text result
    const result = await sendMessageDingTalk({ cfg, sessionWebhook: to, text: text ?? "" });
    return { channel: "dingtalk", conversationId: result.conversationId, messageId: result.processQueryKey || "" };
  },
};
