import type {
  ChannelOnboardingAdapter,
  ChannelOnboardingDmPolicy,
  ClawdbotConfig,
  DmPolicy,
  WizardPrompter,
} from "clawdbot/plugin-sdk";
import { addWildcardAllowFrom, DEFAULT_ACCOUNT_ID, formatDocsLink } from "clawdbot/plugin-sdk";

import { resolveDingTalkCredentials } from "./accounts.js";
import { probeDingTalk } from "./probe.js";
import type { DingTalkConfig } from "./types.js";

const channel = "dingtalk" as const;

function setDingTalkDmPolicy(cfg: ClawdbotConfig, dmPolicy: DmPolicy): ClawdbotConfig {
  const allowFrom =
    dmPolicy === "open"
      ? addWildcardAllowFrom(cfg.channels?.dingtalk?.allowFrom)?.map((entry) => String(entry))
      : undefined;
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      dingtalk: {
        ...cfg.channels?.dingtalk,
        dmPolicy,
        ...(allowFrom ? { allowFrom } : {}),
      },
    },
  };
}

function setDingTalkAllowFrom(cfg: ClawdbotConfig, allowFrom: string[]): ClawdbotConfig {
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      dingtalk: {
        ...cfg.channels?.dingtalk,
        allowFrom,
      },
    },
  };
}

function parseAllowFromInput(raw: string): string[] {
  return raw
    .split(/[\n,;]+/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function promptDingTalkAllowFrom(params: {
  cfg: ClawdbotConfig;
  prompter: WizardPrompter;
}): Promise<ClawdbotConfig> {
  const existing = params.cfg.channels?.dingtalk?.allowFrom ?? [];
  await params.prompter.note(
    [
      "Allowlist DingTalk DMs by staffId.",
      "You can find user staffId in DingTalk admin console or via API.",
      "Examples:",
      "- 123456789",
      "- manager001",
    ].join("\n"),
    "DingTalk allowlist",
  );

  while (true) {
    const entry = await params.prompter.text({
      message: "DingTalk allowFrom (user staffIds)",
      placeholder: "123456789, manager001",
      initialValue: existing[0] ? String(existing[0]) : undefined,
      validate: (value) => (String(value ?? "").trim() ? undefined : "Required"),
    });
    const parts = parseAllowFromInput(String(entry));
    if (parts.length === 0) {
      await params.prompter.note("Enter at least one user.", "DingTalk allowlist");
      continue;
    }

    const unique = [
      ...new Set([...existing.map((v) => String(v).trim()).filter(Boolean), ...parts]),
    ];
    return setDingTalkAllowFrom(params.cfg, unique);
  }
}

async function noteDingTalkCredentialHelp(prompter: WizardPrompter): Promise<void> {
  await prompter.note(
    [
      "1) Go to DingTalk Developer Console (open-dev.dingtalk.com)",
      "2) Create an enterprise internal application",
      "3) Get AppKey (ClientID) and AppSecret (ClientSecret) from Credentials page",
      "4) Enable Robot capability and select Stream mode",
      "5) Publish the app or add to test group",
      "Tip: you can also set DINGTALK_APP_KEY / DINGTALK_APP_SECRET env vars.",
      `Docs: ${formatDocsLink("/channels/dingtalk", "dingtalk")}`,
    ].join("\n"),
    "DingTalk credentials",
  );
}

function setDingTalkGroupPolicy(
  cfg: ClawdbotConfig,
  groupPolicy: "open" | "allowlist" | "disabled",
): ClawdbotConfig {
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      dingtalk: {
        ...cfg.channels?.dingtalk,
        enabled: true,
        groupPolicy,
      },
    },
  };
}

function setDingTalkGroupAllowFrom(cfg: ClawdbotConfig, groupAllowFrom: string[]): ClawdbotConfig {
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      dingtalk: {
        ...cfg.channels?.dingtalk,
        groupAllowFrom,
      },
    },
  };
}

const dmPolicy: ChannelOnboardingDmPolicy = {
  label: "DingTalk",
  channel,
  policyKey: "channels.dingtalk.dmPolicy",
  allowFromKey: "channels.dingtalk.allowFrom",
  getCurrent: (cfg) => (cfg.channels?.dingtalk as DingTalkConfig | undefined)?.dmPolicy ?? "pairing",
  setPolicy: (cfg, policy) => setDingTalkDmPolicy(cfg, policy),
  promptAllowFrom: promptDingTalkAllowFrom,
};

export const dingtalkOnboardingAdapter: ChannelOnboardingAdapter = {
  channel,
  getStatus: async ({ cfg }) => {
    const dingtalkCfg = cfg.channels?.dingtalk as DingTalkConfig | undefined;
    const configured = Boolean(resolveDingTalkCredentials(dingtalkCfg));

    // Try to probe if configured
    let probeResult = null;
    if (configured && dingtalkCfg) {
      try {
        probeResult = await probeDingTalk(dingtalkCfg);
      } catch {
        // Ignore probe errors
      }
    }

    const statusLines: string[] = [];
    if (!configured) {
      statusLines.push("DingTalk: needs app credentials");
    } else if (probeResult?.ok) {
      statusLines.push(`DingTalk: connected (${probeResult.appKey ?? "bot"})`);
    } else {
      statusLines.push("DingTalk: configured (connection not verified)");
    }

    return {
      channel,
      configured,
      statusLines,
      selectionHint: configured ? "configured" : "needs app creds",
      quickstartScore: configured ? 2 : 0,
    };
  },

  configure: async ({ cfg, prompter }) => {
    const dingtalkCfg = cfg.channels?.dingtalk as DingTalkConfig | undefined;
    const resolved = resolveDingTalkCredentials(dingtalkCfg);
    const hasConfigCreds = Boolean(dingtalkCfg?.appKey?.trim() && dingtalkCfg?.appSecret?.trim());
    const canUseEnv = Boolean(
      !hasConfigCreds &&
        process.env.DINGTALK_APP_KEY?.trim() &&
        process.env.DINGTALK_APP_SECRET?.trim(),
    );

    let next = cfg;
    let appKey: string | null = null;
    let appSecret: string | null = null;

    if (!resolved) {
      await noteDingTalkCredentialHelp(prompter);
    }

    if (canUseEnv) {
      const keepEnv = await prompter.confirm({
        message: "DINGTALK_APP_KEY + DINGTALK_APP_SECRET detected. Use env vars?",
        initialValue: true,
      });
      if (keepEnv) {
        next = {
          ...next,
          channels: {
            ...next.channels,
            dingtalk: { ...next.channels?.dingtalk, enabled: true },
          },
        };
      } else {
        appKey = String(
          await prompter.text({
            message: "Enter DingTalk AppKey (ClientID)",
            validate: (value) => (value?.trim() ? undefined : "Required"),
          }),
        ).trim();
        appSecret = String(
          await prompter.text({
            message: "Enter DingTalk AppSecret (ClientSecret)",
            validate: (value) => (value?.trim() ? undefined : "Required"),
          }),
        ).trim();
      }
    } else if (hasConfigCreds) {
      const keep = await prompter.confirm({
        message: "DingTalk credentials already configured. Keep them?",
        initialValue: true,
      });
      if (!keep) {
        appKey = String(
          await prompter.text({
            message: "Enter DingTalk AppKey (ClientID)",
            validate: (value) => (value?.trim() ? undefined : "Required"),
          }),
        ).trim();
        appSecret = String(
          await prompter.text({
            message: "Enter DingTalk AppSecret (ClientSecret)",
            validate: (value) => (value?.trim() ? undefined : "Required"),
          }),
        ).trim();
      }
    } else {
      appKey = String(
        await prompter.text({
          message: "Enter DingTalk AppKey (ClientID)",
          validate: (value) => (value?.trim() ? undefined : "Required"),
        }),
      ).trim();
      appSecret = String(
        await prompter.text({
          message: "Enter DingTalk AppSecret (ClientSecret)",
          validate: (value) => (value?.trim() ? undefined : "Required"),
        }),
      ).trim();
    }

    if (appKey && appSecret) {
      next = {
        ...next,
        channels: {
          ...next.channels,
          dingtalk: {
            ...next.channels?.dingtalk,
            enabled: true,
            appKey,
            appSecret,
          },
        },
      };

      // Test connection
      const testCfg = next.channels?.dingtalk as DingTalkConfig;
      try {
        const probe = await probeDingTalk(testCfg);
        if (probe.ok) {
          await prompter.note(
            `Connected (${probe.appKey ?? "bot"})`,
            "DingTalk connection test",
          );
        } else {
          await prompter.note(
            `Connection failed: ${probe.error ?? "unknown error"}`,
            "DingTalk connection test",
          );
        }
      } catch (err) {
        await prompter.note(`Connection test failed: ${String(err)}`, "DingTalk connection test");
      }
    }

    // Robot code (optional)
    const currentRobotCode = (next.channels?.dingtalk as DingTalkConfig | undefined)?.robotCode;
    const robotCode = await prompter.text({
      message: "Robot code (optional, for media download)",
      placeholder: "dingxxxxxxxxx",
      initialValue: currentRobotCode,
    });
    if (robotCode) {
      next = {
        ...next,
        channels: {
          ...next.channels,
          dingtalk: {
            ...next.channels?.dingtalk,
            robotCode: String(robotCode).trim(),
          },
        },
      };
    }

    // Group policy
    const groupPolicy = await prompter.select({
      message: "Group chat policy",
      options: [
        { value: "allowlist", label: "Allowlist - only respond in specific groups" },
        { value: "open", label: "Open - respond in all groups (requires mention)" },
        { value: "disabled", label: "Disabled - don't respond in groups" },
      ],
      initialValue:
        (next.channels?.dingtalk as DingTalkConfig | undefined)?.groupPolicy ?? "allowlist",
    });
    if (groupPolicy) {
      next = setDingTalkGroupPolicy(next, groupPolicy as "open" | "allowlist" | "disabled");
    }

    // Group allowlist if needed
    if (groupPolicy === "allowlist") {
      const existing = (next.channels?.dingtalk as DingTalkConfig | undefined)?.groupAllowFrom ?? [];
      const entry = await prompter.text({
        message: "Group chat allowlist (conversationIds)",
        placeholder: "cidXXXXX, cidYYYYY",
        initialValue: existing.length > 0 ? existing.map(String).join(", ") : undefined,
      });
      if (entry) {
        const parts = parseAllowFromInput(String(entry));
        if (parts.length > 0) {
          next = setDingTalkGroupAllowFrom(next, parts);
        }
      }
    }

    return { cfg: next, accountId: DEFAULT_ACCOUNT_ID };
  },

  dmPolicy,

  disable: (cfg) => ({
    ...cfg,
    channels: {
      ...cfg.channels,
      dingtalk: { ...cfg.channels?.dingtalk, enabled: false },
    },
  }),
};
