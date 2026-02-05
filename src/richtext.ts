/**
 * Shared richText parsing utilities for DingTalk.
 *
 * DingTalk sends mixed text+image messages as msgtype "richText" with
 * content structured as: { richText: [{ text: "..." }, { type: "picture", downloadCode: "..." }] }
 */

/** Maximum number of images to extract from a single richText message. */
export const MAX_RICHTEXT_IMAGES = 10;

/**
 * Safely parse richText content that may be a JSON string or already-parsed object.
 */
export function safeParseRichText(content: unknown): unknown | null {
  if (typeof content === "string") {
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
  if (content && typeof content === "object") return content;
  return null;
}

/**
 * Extract human-readable text from a richText structure.
 * Picture nodes are replaced with "[图片]" placeholders.
 */
export function extractRichTextContent(richText: unknown): string {
  if (!richText || typeof richText !== "object") return "";
  const parts: string[] = [];

  function traverse(node: unknown): void {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) {
        traverse(item);
      }
      return;
    }
    const obj = node as Record<string, unknown>;
    if (obj.type === "picture") {
      parts.push("[图片]");
    } else if (obj.text && typeof obj.text === "string") {
      parts.push(obj.text);
    }
    if (obj.richText) {
      traverse(obj.richText);
    }
    if (obj.content) {
      traverse(obj.content);
    }
  }

  traverse(richText);
  return parts.join("").trim() || "[富文本消息]";
}

/**
 * Extract downloadCodes from picture nodes within a richText structure.
 * Checks both `downloadCode` and `pictureDownloadCode` fields.
 * Returns at most MAX_RICHTEXT_IMAGES codes.
 */
export function extractRichTextDownloadCodes(richText: unknown): string[] {
  if (!richText || typeof richText !== "object") return [];
  const codes: string[] = [];

  function traverse(node: unknown): void {
    if (codes.length >= MAX_RICHTEXT_IMAGES) return;
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) {
        traverse(item);
      }
      return;
    }
    const obj = node as Record<string, unknown>;
    if (obj.type === "picture") {
      const code = (typeof obj.downloadCode === "string" ? obj.downloadCode : undefined)
        || (typeof obj.pictureDownloadCode === "string" ? obj.pictureDownloadCode : undefined);
      if (code) codes.push(code);
    }
    if (obj.richText) {
      traverse(obj.richText);
    }
    if (obj.content) {
      traverse(obj.content);
    }
  }

  traverse(richText);
  return codes;
}
