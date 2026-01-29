import type { ClawdbotConfig } from "clawdbot/plugin-sdk";
import type { DWClient } from "dingtalk-stream";
import type { DingTalkConfig } from "./types.js";
import fs from "fs";
import path from "path";

export type DownloadMediaResult = {
  buffer: Buffer;
  contentType?: string;
  fileName?: string;
};

export type UploadMediaResult = {
  mediaId: string;
};

export type SendMediaResult = {
  conversationId: string;
  processQueryKey?: string;
};

/**
 * Download media from DingTalk message using downloadCode.
 * Note: This requires OpenAPI access token.
 */
export async function downloadMediaDingTalk(params: {
  cfg: ClawdbotConfig;
  downloadCode: string;
  robotCode?: string;
  client?: DWClient;
}): Promise<DownloadMediaResult | null> {
  const { cfg, downloadCode, robotCode, client } = params;
  const dingtalkCfg = cfg.channels?.dingtalk as DingTalkConfig | undefined;
  if (!dingtalkCfg) {
    throw new Error("DingTalk channel not configured");
  }

  if (!client) {
    // Cannot download without client for access token
    return null;
  }

  try {
    const accessToken = await client.getAccessToken();

    // DingTalk media download API
    // https://api.dingtalk.com/v1.0/robot/messageFiles/download
    const response = await fetch("https://api.dingtalk.com/v1.0/robot/messageFiles/download", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-acs-dingtalk-access-token": accessToken,
      },
      body: JSON.stringify({
        downloadCode,
        robotCode: robotCode || dingtalkCfg.robotCode,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`DingTalk media download failed: ${response.status} ${text}`);
    }

    const result = await response.json() as { downloadUrl?: string };

    if (!result.downloadUrl) {
      throw new Error("DingTalk media download failed: no downloadUrl returned");
    }

    // Download the actual file from the URL
    const fileResponse = await fetch(result.downloadUrl);
    if (!fileResponse.ok) {
      throw new Error(`Failed to download file from URL: ${fileResponse.status}`);
    }

    const buffer = Buffer.from(await fileResponse.arrayBuffer());
    const contentType = fileResponse.headers.get("content-type") || undefined;

    return { buffer, contentType };
  } catch (err) {
    console.error(`DingTalk media download error: ${String(err)}`);
    return null;
  }
}

/**
 * Upload media to DingTalk via OpenAPI.
 * This can be used for sending images/files in messages.
 */
export async function uploadMediaDingTalk(params: {
  cfg: ClawdbotConfig;
  buffer: Buffer;
  fileName: string;
  mediaType: "image" | "file" | "voice";
  client?: DWClient;
}): Promise<UploadMediaResult | null> {
  const { cfg, buffer, fileName, mediaType, client } = params;
  const dingtalkCfg = cfg.channels?.dingtalk as DingTalkConfig | undefined;
  if (!dingtalkCfg) {
    throw new Error("DingTalk channel not configured");
  }

  if (!client) {
    return null;
  }

  try {
    const accessToken = await client.getAccessToken();

    // DingTalk media upload uses multipart form data
    // https://api.dingtalk.com/v1.0/robot/messageFiles/upload
    const formData = new FormData();
    // Convert Buffer to ArrayBuffer for Blob compatibility
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    const blob = new Blob([arrayBuffer], { type: "application/octet-stream" });
    formData.append("file", blob, fileName);
    formData.append("type", mediaType);
    formData.append("robotCode", dingtalkCfg.robotCode || "");

    const response = await fetch("https://api.dingtalk.com/v1.0/robot/messageFiles/upload", {
      method: "POST",
      headers: {
        "x-acs-dingtalk-access-token": accessToken,
      },
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`DingTalk media upload failed: ${response.status} ${text}`);
    }

    const result = await response.json() as { mediaId?: string };

    if (!result.mediaId) {
      throw new Error("DingTalk media upload failed: no mediaId returned");
    }

    return { mediaId: result.mediaId };
  } catch (err) {
    console.error(`DingTalk media upload error: ${String(err)}`);
    return null;
  }
}

/**
 * Send an image via sessionWebhook using markdown with image URL.
 * Note: DingTalk sessionWebhook has limited support for images.
 * For better image support, use OpenAPI.
 */
export async function sendImageDingTalk(params: {
  cfg: ClawdbotConfig;
  sessionWebhook: string;
  imageUrl: string;
  title?: string;
  client?: DWClient;
}): Promise<SendMediaResult> {
  const { sessionWebhook, imageUrl, title, client } = params;

  let accessToken: string | undefined;
  if (client) {
    try {
      accessToken = await client.getAccessToken();
    } catch {
      // Proceed without access token
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (accessToken) {
    headers["x-acs-dingtalk-access-token"] = accessToken;
  }

  // Use markdown format to embed image
  const message = {
    msgtype: "markdown",
    markdown: {
      title: title || "Image",
      text: `![image](${imageUrl})`,
    },
  };

  const response = await fetch(sessionWebhook, {
    method: "POST",
    headers,
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`DingTalk image send failed: ${response.status} ${text}`);
  }

  const result = await response.json() as { errcode?: number; errmsg?: string; processQueryKey?: string };

  if (result.errcode && result.errcode !== 0) {
    throw new Error(`DingTalk image send failed: ${result.errmsg || `code ${result.errcode}`}`);
  }

  return {
    conversationId: "",
    processQueryKey: result.processQueryKey,
  };
}

/**
 * Send a file link via sessionWebhook.
 * Note: DingTalk sessionWebhook doesn't support file attachments directly.
 * This sends a link message pointing to the file URL.
 */
export async function sendFileDingTalk(params: {
  cfg: ClawdbotConfig;
  sessionWebhook: string;
  fileUrl: string;
  fileName: string;
  client?: DWClient;
}): Promise<SendMediaResult> {
  const { sessionWebhook, fileUrl, fileName, client } = params;

  let accessToken: string | undefined;
  if (client) {
    try {
      accessToken = await client.getAccessToken();
    } catch {
      // Proceed without access token
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (accessToken) {
    headers["x-acs-dingtalk-access-token"] = accessToken;
  }

  // Use link format for files
  const message = {
    msgtype: "link",
    link: {
      title: fileName,
      text: `File: ${fileName}`,
      messageUrl: fileUrl,
      picUrl: "",
    },
  };

  const response = await fetch(sessionWebhook, {
    method: "POST",
    headers,
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`DingTalk file send failed: ${response.status} ${text}`);
  }

  const result = await response.json() as { errcode?: number; errmsg?: string; processQueryKey?: string };

  if (result.errcode && result.errcode !== 0) {
    throw new Error(`DingTalk file send failed: ${result.errmsg || `code ${result.errcode}`}`);
  }

  return {
    conversationId: "",
    processQueryKey: result.processQueryKey,
  };
}

/**
 * Helper to detect file type from extension
 */
export function detectFileType(
  fileName: string,
): "image" | "file" | "voice" {
  const ext = path.extname(fileName).toLowerCase();
  const imageExts = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"];
  const voiceExts = [".opus", ".ogg", ".mp3", ".wav", ".m4a"];

  if (imageExts.includes(ext)) {
    return "image";
  } else if (voiceExts.includes(ext)) {
    return "voice";
  }
  return "file";
}

/**
 * Check if a string is a local file path (not a URL)
 */
function isLocalPath(urlOrPath: string): boolean {
  if (urlOrPath.startsWith("/") || urlOrPath.startsWith("~") || /^[a-zA-Z]:/.test(urlOrPath)) {
    return true;
  }
  try {
    const url = new URL(urlOrPath);
    return url.protocol === "file:";
  } catch {
    return true;
  }
}

/**
 * Send media via sessionWebhook (limited support)
 */
export async function sendMediaDingTalk(params: {
  cfg: ClawdbotConfig;
  sessionWebhook: string;
  mediaUrl?: string;
  mediaBuffer?: Buffer;
  fileName?: string;
  client?: DWClient;
}): Promise<SendMediaResult> {
  const { cfg, sessionWebhook, mediaUrl, mediaBuffer, fileName, client } = params;

  let buffer: Buffer | undefined;
  let name: string;
  let url: string | undefined;

  if (mediaBuffer) {
    buffer = mediaBuffer;
    name = fileName ?? "file";
  } else if (mediaUrl) {
    if (isLocalPath(mediaUrl)) {
      const filePath = mediaUrl.startsWith("~")
        ? mediaUrl.replace("~", process.env.HOME ?? "")
        : mediaUrl.replace("file://", "");

      if (!fs.existsSync(filePath)) {
        throw new Error(`Local file not found: ${filePath}`);
      }
      buffer = fs.readFileSync(filePath);
      name = fileName ?? path.basename(filePath);
    } else {
      // Remote URL - can send directly as link
      url = mediaUrl;
      name = fileName ?? (path.basename(new URL(mediaUrl).pathname) || "file");
    }
  } else {
    throw new Error("Either mediaUrl or mediaBuffer must be provided");
  }

  const fileType = detectFileType(name);

  if (url) {
    // Send as link/image depending on type
    if (fileType === "image") {
      return sendImageDingTalk({ cfg, sessionWebhook, imageUrl: url, title: name, client });
    } else {
      return sendFileDingTalk({ cfg, sessionWebhook, fileUrl: url, fileName: name, client });
    }
  }

  // For local files, we need to upload first
  if (buffer && client) {
    const uploadResult = await uploadMediaDingTalk({
      cfg,
      buffer,
      fileName: name,
      mediaType: fileType,
      client,
    });

    if (uploadResult) {
      // Note: mediaId usage depends on specific DingTalk API
      // For now, return a result indicating upload was successful
      return {
        conversationId: "",
        processQueryKey: uploadResult.mediaId,
      };
    }
  }

  throw new Error("Unable to send media: upload failed or no client available");
}
