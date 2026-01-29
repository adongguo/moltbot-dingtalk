import type { ClawdbotConfig } from "clawdbot/plugin-sdk";
import { DEFAULT_ACCOUNT_ID } from "clawdbot/plugin-sdk";
import type { DingTalkConfig, ResolvedDingTalkAccount } from "./types.js";

export function resolveDingTalkCredentials(cfg?: DingTalkConfig): {
  appKey: string;
  appSecret: string;
  robotCode?: string;
} | null {
  const appKey = cfg?.appKey?.trim();
  const appSecret = cfg?.appSecret?.trim();
  if (!appKey || !appSecret) return null;
  return {
    appKey,
    appSecret,
    robotCode: cfg?.robotCode?.trim() || undefined,
  };
}

export function resolveDingTalkAccount(params: {
  cfg: ClawdbotConfig;
  accountId?: string | null;
}): ResolvedDingTalkAccount {
  const dingtalkCfg = params.cfg.channels?.dingtalk as DingTalkConfig | undefined;
  const enabled = dingtalkCfg?.enabled !== false;
  const creds = resolveDingTalkCredentials(dingtalkCfg);

  return {
    accountId: params.accountId?.trim() || DEFAULT_ACCOUNT_ID,
    enabled,
    configured: Boolean(creds),
    appKey: creds?.appKey,
    robotCode: creds?.robotCode,
  };
}

export function listDingTalkAccountIds(_cfg: ClawdbotConfig): string[] {
  return [DEFAULT_ACCOUNT_ID];
}

export function resolveDefaultDingTalkAccountId(_cfg: ClawdbotConfig): string {
  return DEFAULT_ACCOUNT_ID;
}

export function listEnabledDingTalkAccounts(cfg: ClawdbotConfig): ResolvedDingTalkAccount[] {
  return listDingTalkAccountIds(cfg)
    .map((accountId) => resolveDingTalkAccount({ cfg, accountId }))
    .filter((account) => account.enabled && account.configured);
}
