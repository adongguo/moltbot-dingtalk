import type { ClawdbotConfig } from "openclaw/plugin-sdk";
import type { DingTalkConfig } from "./types.js";
import { normalizeDingTalkTarget } from "./targets.js";

export type DingTalkDirectoryPeer = {
  kind: "user";
  id: string;
  name?: string;
};

export type DingTalkDirectoryGroup = {
  kind: "group";
  id: string;
  name?: string;
};

export async function listDingTalkDirectoryPeers(params: {
  cfg: ClawdbotConfig;
  query?: string;
  limit?: number;
}): Promise<DingTalkDirectoryPeer[]> {
  const dingtalkCfg = params.cfg.channels?.dingtalk as DingTalkConfig | undefined;
  const q = params.query?.trim().toLowerCase() || "";
  const ids = new Set<string>();

  for (const entry of dingtalkCfg?.allowFrom ?? []) {
    const trimmed = String(entry).trim();
    if (trimmed && trimmed !== "*") ids.add(trimmed);
  }

  for (const userId of Object.keys(dingtalkCfg?.dms ?? {})) {
    const trimmed = userId.trim();
    if (trimmed) ids.add(trimmed);
  }

  return Array.from(ids)
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => normalizeDingTalkTarget(raw) ?? raw)
    .filter((id) => (q ? id.toLowerCase().includes(q) : true))
    .slice(0, params.limit && params.limit > 0 ? params.limit : undefined)
    .map((id) => ({ kind: "user" as const, id }));
}

export async function listDingTalkDirectoryGroups(params: {
  cfg: ClawdbotConfig;
  query?: string;
  limit?: number;
}): Promise<DingTalkDirectoryGroup[]> {
  const dingtalkCfg = params.cfg.channels?.dingtalk as DingTalkConfig | undefined;
  const q = params.query?.trim().toLowerCase() || "";
  const ids = new Set<string>();

  for (const groupId of Object.keys(dingtalkCfg?.groups ?? {})) {
    const trimmed = groupId.trim();
    if (trimmed && trimmed !== "*") ids.add(trimmed);
  }

  for (const entry of dingtalkCfg?.groupAllowFrom ?? []) {
    const trimmed = String(entry).trim();
    if (trimmed && trimmed !== "*") ids.add(trimmed);
  }

  return Array.from(ids)
    .map((raw) => raw.trim())
    .filter(Boolean)
    .filter((id) => (q ? id.toLowerCase().includes(q) : true))
    .slice(0, params.limit && params.limit > 0 ? params.limit : undefined)
    .map((id) => ({ kind: "group" as const, id }));
}

// DingTalk doesn't provide directory listing APIs via bot API
// These stubs return the same results as the config-based versions
export async function listDingTalkDirectoryPeersLive(params: {
  cfg: ClawdbotConfig;
  query?: string;
  limit?: number;
}): Promise<DingTalkDirectoryPeer[]> {
  // DingTalk bot API doesn't support listing users
  return listDingTalkDirectoryPeers(params);
}

export async function listDingTalkDirectoryGroupsLive(params: {
  cfg: ClawdbotConfig;
  query?: string;
  limit?: number;
}): Promise<DingTalkDirectoryGroup[]> {
  // DingTalk bot API doesn't support listing groups
  return listDingTalkDirectoryGroups(params);
}
