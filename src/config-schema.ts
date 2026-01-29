import { z } from "zod";
export { z };

const DmPolicySchema = z.enum(["open", "pairing", "allowlist"]);
const GroupPolicySchema = z.enum(["open", "allowlist", "disabled"]);
const DingTalkConnectionModeSchema = z.enum(["stream", "webhook"]);

const ToolPolicySchema = z
  .object({
    allow: z.array(z.string()).optional(),
    deny: z.array(z.string()).optional(),
  })
  .strict()
  .optional();

const DmConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    systemPrompt: z.string().optional(),
  })
  .strict()
  .optional();

const MarkdownConfigSchema = z
  .object({
    mode: z.enum(["native", "escape", "strip"]).optional(),
    tableMode: z.enum(["native", "ascii", "simple"]).optional(),
  })
  .strict()
  .optional();

// Message render mode: auto (default) = detect markdown, raw = plain text, card = always action_card
const RenderModeSchema = z.enum(["auto", "raw", "card"]).optional();

const BlockStreamingCoalesceSchema = z
  .object({
    enabled: z.boolean().optional(),
    minDelayMs: z.number().int().positive().optional(),
    maxDelayMs: z.number().int().positive().optional(),
  })
  .strict()
  .optional();

const ChannelHeartbeatVisibilitySchema = z
  .object({
    visibility: z.enum(["visible", "hidden"]).optional(),
    intervalMs: z.number().int().positive().optional(),
  })
  .strict()
  .optional();

export const DingTalkGroupSchema = z
  .object({
    requireMention: z.boolean().optional(),
    tools: ToolPolicySchema,
    skills: z.array(z.string()).optional(),
    enabled: z.boolean().optional(),
    allowFrom: z.array(z.union([z.string(), z.number()])).optional(),
    systemPrompt: z.string().optional(),
  })
  .strict();

export const DingTalkConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    appKey: z.string().optional(), // DingTalk uses appKey (ClientID)
    appSecret: z.string().optional(), // DingTalk uses appSecret (ClientSecret)
    robotCode: z.string().optional(), // Robot code for identifying the bot
    connectionMode: DingTalkConnectionModeSchema.optional().default("stream"),
    webhookPath: z.string().optional().default("/dingtalk/events"),
    webhookPort: z.number().int().positive().optional(),
    capabilities: z.array(z.string()).optional(),
    markdown: MarkdownConfigSchema,
    configWrites: z.boolean().optional(),
    dmPolicy: DmPolicySchema.optional().default("pairing"),
    allowFrom: z.array(z.union([z.string(), z.number()])).optional(),
    groupPolicy: GroupPolicySchema.optional().default("allowlist"),
    groupAllowFrom: z.array(z.union([z.string(), z.number()])).optional(),
    requireMention: z.boolean().optional().default(true),
    groups: z.record(z.string(), DingTalkGroupSchema.optional()).optional(),
    historyLimit: z.number().int().min(0).optional(),
    dmHistoryLimit: z.number().int().min(0).optional(),
    dms: z.record(z.string(), DmConfigSchema).optional(),
    textChunkLimit: z.number().int().positive().optional(),
    chunkMode: z.enum(["length", "newline"]).optional(),
    blockStreamingCoalesce: BlockStreamingCoalesceSchema,
    mediaMaxMb: z.number().positive().optional(),
    heartbeat: ChannelHeartbeatVisibilitySchema,
    renderMode: RenderModeSchema, // raw = plain text, card = action card with markdown
    // DingTalk specific options
    cooldownMs: z.number().int().positive().optional(), // Cooldown between messages to avoid rate limiting
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.dmPolicy === "open") {
      const allowFrom = value.allowFrom ?? [];
      const hasWildcard = allowFrom.some((entry) => String(entry).trim() === "*");
      if (!hasWildcard) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["allowFrom"],
          message: 'channels.dingtalk.dmPolicy="open" requires channels.dingtalk.allowFrom to include "*"',
        });
      }
    }
  });
