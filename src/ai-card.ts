/**
 * AI Card Streaming for DingTalk
 *
 * Implements AI Card creation, streaming updates, and completion.
 * Provides typewriter effect for AI responses in DingTalk.
 */

import type { DingTalkConfig, DingTalkIncomingMessage } from "./types.js";

// ============ Constants ============

/** AI Card template ID (DingTalk official AI Card template) */
const AI_CARD_TEMPLATE_ID = "382e4302-551d-4880-bf29-a30acfab2e71.schema";

/** DingTalk API base URL */
const DINGTALK_API = "https://api.dingtalk.com";

/** AI Card status values (consistent with DingTalk SDK) */
export const AICardStatus = {
  PROCESSING: "1",
  INPUTING: "2",
  FINISHED: "3",
  EXECUTING: "4",
  FAILED: "5",
} as const;

export type AICardStatusType = (typeof AICardStatus)[keyof typeof AICardStatus];

// ============ Types ============

export interface AICardInstance {
  cardInstanceId: string;
  accessToken: string;
  inputingStarted: boolean;
}

export interface AICardMessageData {
  conversationType: "1" | "2";
  conversationId: string;
  senderStaffId?: string;
  senderId?: string;
}

interface Logger {
  info?: (msg: string) => void;
  warn?: (msg: string) => void;
  error?: (msg: string) => void;
}

// ============ Access Token Cache ============

let accessToken: string | null = null;
let accessTokenExpiry = 0;

/**
 * Get access token for DingTalk API, with caching.
 */
export async function getAccessToken(config: DingTalkConfig): Promise<string> {
  const now = Date.now();
  if (accessToken && accessTokenExpiry > now + 60_000) {
    return accessToken;
  }

  const response = await fetch(`${DINGTALK_API}/v1.0/oauth2/accessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      appKey: config.appKey,
      appSecret: config.appSecret,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get access token: ${response.status} ${text}`);
  }

  const data = (await response.json()) as { accessToken: string; expireIn: number };
  accessToken = data.accessToken;
  accessTokenExpiry = now + data.expireIn * 1000;
  return accessToken;
}

/**
 * Clear the access token cache.
 */
export function clearAccessTokenCache(): void {
  accessToken = null;
  accessTokenExpiry = 0;
}

// ============ AI Card Functions ============

/**
 * Create and deliver an AI Card instance.
 * Returns null if creation fails (caller should fall back to regular message).
 */
export async function createAICard(
  config: DingTalkConfig,
  data: AICardMessageData,
  log?: Logger,
): Promise<AICardInstance | null> {
  try {
    const token = await getAccessToken(config);
    const cardInstanceId = `card_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    log?.info?.(`[DingTalk][AICard] Creating card outTrackId=${cardInstanceId}`);
    log?.info?.(
      `[DingTalk][AICard] conversationType=${data.conversationType}, conversationId=${data.conversationId}`,
    );

    // 1. Create card instance (empty cardParamMap, no preset flowStatus)
    const createBody = {
      cardTemplateId: AI_CARD_TEMPLATE_ID,
      outTrackId: cardInstanceId,
      cardData: {
        cardParamMap: {},
      },
      callbackType: "STREAM",
      imGroupOpenSpaceModel: { supportForward: true },
      imRobotOpenSpaceModel: { supportForward: true },
    };

    log?.info?.(`[DingTalk][AICard] POST /v1.0/card/instances body=${JSON.stringify(createBody)}`);
    const createResp = await fetch(`${DINGTALK_API}/v1.0/card/instances`, {
      method: "POST",
      headers: {
        "x-acs-dingtalk-access-token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createBody),
    });

    if (!createResp.ok) {
      const text = await createResp.text();
      log?.error?.(`[DingTalk][AICard] Create failed: ${createResp.status} ${text}`);
      return null;
    }

    const createData = await createResp.json();
    log?.info?.(`[DingTalk][AICard] Create response: ${JSON.stringify(createData)}`);

    // 2. Deliver card
    const isGroup = data.conversationType === "2";
    const deliverBody: Record<string, unknown> = {
      outTrackId: cardInstanceId,
      userIdType: 1,
    };

    if (isGroup) {
      deliverBody.openSpaceId = `dtv1.card//IM_GROUP.${data.conversationId}`;
      deliverBody.imGroupOpenDeliverModel = {
        robotCode: config.appKey,
      };
    } else {
      const userId = data.senderStaffId || data.senderId;
      deliverBody.openSpaceId = `dtv1.card//IM_ROBOT.${userId}`;
      deliverBody.imRobotOpenDeliverModel = { spaceType: "IM_ROBOT" };
    }

    log?.info?.(`[DingTalk][AICard] POST /v1.0/card/instances/deliver body=${JSON.stringify(deliverBody)}`);
    const deliverResp = await fetch(`${DINGTALK_API}/v1.0/card/instances/deliver`, {
      method: "POST",
      headers: {
        "x-acs-dingtalk-access-token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(deliverBody),
    });

    if (!deliverResp.ok) {
      const text = await deliverResp.text();
      log?.error?.(`[DingTalk][AICard] Deliver failed: ${deliverResp.status} ${text}`);
      return null;
    }

    const deliverData = await deliverResp.json();
    log?.info?.(`[DingTalk][AICard] Deliver response: ${JSON.stringify(deliverData)}`);

    return { cardInstanceId, accessToken: token, inputingStarted: false };
  } catch (err: unknown) {
    const errMessage = err instanceof Error ? err.message : String(err);
    log?.error?.(`[DingTalk][AICard] Create card failed: ${errMessage}`);
    return null;
  }
}

/**
 * Stream content update to AI Card.
 * First call switches card to INPUTING status.
 */
export async function streamAICard(
  card: AICardInstance,
  content: string,
  finished: boolean = false,
  log?: Logger,
): Promise<void> {
  // First streaming call: switch to INPUTING status
  if (!card.inputingStarted) {
    const statusBody = {
      outTrackId: card.cardInstanceId,
      cardData: {
        cardParamMap: {
          flowStatus: AICardStatus.INPUTING,
          msgContent: "",
          staticMsgContent: "",
          sys_full_json_obj: JSON.stringify({
            order: ["msgContent"],
          }),
        },
      },
    };

    log?.info?.(`[DingTalk][AICard] PUT /v1.0/card/instances (INPUTING) outTrackId=${card.cardInstanceId}`);
    const statusResp = await fetch(`${DINGTALK_API}/v1.0/card/instances`, {
      method: "PUT",
      headers: {
        "x-acs-dingtalk-access-token": card.accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(statusBody),
    });

    if (!statusResp.ok) {
      const text = await statusResp.text();
      log?.error?.(`[DingTalk][AICard] INPUTING switch failed: ${statusResp.status} ${text}`);
      throw new Error(`INPUTING switch failed: ${statusResp.status}`);
    }

    log?.info?.(`[DingTalk][AICard] INPUTING response: ${statusResp.status}`);
    card.inputingStarted = true;
  }

  // Stream content update
  const body = {
    outTrackId: card.cardInstanceId,
    guid: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    key: "msgContent",
    content: content,
    isFull: true, // Full replacement
    isFinalize: finished,
    isError: false,
  };

  log?.info?.(
    `[DingTalk][AICard] PUT /v1.0/card/streaming contentLen=${content.length} isFinalize=${finished}`,
  );
  const streamResp = await fetch(`${DINGTALK_API}/v1.0/card/streaming`, {
    method: "PUT",
    headers: {
      "x-acs-dingtalk-access-token": card.accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!streamResp.ok) {
    const text = await streamResp.text();
    log?.error?.(`[DingTalk][AICard] Streaming update failed: ${streamResp.status} ${text}`);
    throw new Error(`Streaming update failed: ${streamResp.status}`);
  }

  log?.info?.(`[DingTalk][AICard] Streaming response: ${streamResp.status}`);
}

/**
 * Complete AI Card with final content and FINISHED status.
 */
export async function finishAICard(card: AICardInstance, content: string, log?: Logger): Promise<void> {
  log?.info?.(`[DingTalk][AICard] Finishing card, final content length=${content.length}`);

  // 1. Close streaming channel with final content (isFinalize=true)
  await streamAICard(card, content, true, log);

  // 2. Update card status to FINISHED
  const body = {
    outTrackId: card.cardInstanceId,
    cardData: {
      cardParamMap: {
        flowStatus: AICardStatus.FINISHED,
        msgContent: content,
        staticMsgContent: "",
        sys_full_json_obj: JSON.stringify({
          order: ["msgContent"],
        }),
      },
    },
  };

  log?.info?.(`[DingTalk][AICard] PUT /v1.0/card/instances (FINISHED) outTrackId=${card.cardInstanceId}`);
  const finishResp = await fetch(`${DINGTALK_API}/v1.0/card/instances`, {
    method: "PUT",
    headers: {
      "x-acs-dingtalk-access-token": card.accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!finishResp.ok) {
    const text = await finishResp.text();
    log?.error?.(`[DingTalk][AICard] FINISHED update failed: ${finishResp.status} ${text}`);
  } else {
    log?.info?.(`[DingTalk][AICard] FINISHED response: ${finishResp.status}`);
  }
}

/**
 * Mark AI Card as failed with error message.
 */
export async function failAICard(card: AICardInstance, errorMessage: string, log?: Logger): Promise<void> {
  log?.error?.(`[DingTalk][AICard] Marking card as failed: ${errorMessage}`);

  const body = {
    outTrackId: card.cardInstanceId,
    cardData: {
      cardParamMap: {
        flowStatus: AICardStatus.FAILED,
        msgContent: `Error: ${errorMessage}`,
        staticMsgContent: "",
        sys_full_json_obj: JSON.stringify({
          order: ["msgContent"],
        }),
      },
    },
  };

  try {
    await fetch(`${DINGTALK_API}/v1.0/card/instances`, {
      method: "PUT",
      headers: {
        "x-acs-dingtalk-access-token": card.accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log?.error?.(`[DingTalk][AICard] Failed to mark card as failed: ${errMsg}`);
  }
}
