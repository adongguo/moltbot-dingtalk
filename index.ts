import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import { emptyPluginConfigSchema } from "clawdbot/plugin-sdk";
import { dingtalkPlugin } from "./src/channel.js";
import { setDingTalkRuntime } from "./src/runtime.js";

export { monitorDingTalkProvider } from "./src/monitor.js";
export {
  sendMessageDingTalk,
  sendMarkdownDingTalk,
  sendActionCardDingTalk,
  sendViaWebhook,
} from "./src/send.js";
export {
  uploadMediaDingTalk,
  downloadMediaDingTalk,
  sendImageDingTalk,
  sendFileDingTalk,
  sendMediaDingTalk,
} from "./src/media.js";
export { probeDingTalk } from "./src/probe.js";
export {
  addReactionDingTalk,
  removeReactionDingTalk,
  listReactionsDingTalk,
  DingTalkEmoji,
} from "./src/reactions.js";
export { dingtalkPlugin } from "./src/channel.js";

const plugin = {
  id: "dingtalk",
  name: "DingTalk",
  description: "DingTalk channel plugin",
  configSchema: emptyPluginConfigSchema(),
  register(api: ClawdbotPluginApi) {
    setDingTalkRuntime(api.runtime);
    api.registerChannel({ plugin: dingtalkPlugin });
  },
};

export default plugin;
