# 钉钉插件测试计划

> 生成日期: 2026-02-10  
> 适用范围: Phase 1–11 全部新功能

---

## 目录

1. [环境准备](#1-环境准备)
2. [测试顺序总览](#2-测试顺序总览)
3. [基础测试（无需额外权限）](#3-基础测试)
4. [进阶测试（需要权限）](#4-进阶测试)
5. [回归与稳定性测试](#5-回归与稳定性测试)

---

## 1. 环境准备

### 1.1 构建插件

```bash
cd /root/.openclaw/workspace/openclaw-dingtalk
npm install
npm run build
```

**预期**: 无编译错误，`dist/` 目录生成。

### 1.2 安装到 OpenClaw

```bash
# 方式一：符号链接（开发模式）
cd /root/.openclaw/workspace/openclaw
npm link ../openclaw-dingtalk

# 方式二：直接安装
npm install ../openclaw-dingtalk
```

### 1.3 重启 Gateway

```bash
openclaw gateway restart
```

**验证**: 查看启动日志，应包含：
- `[dingtalk:hook] lifecycle hooks registered`
- `dingtalk: starting Stream connection...`
- `dingtalk: Stream client connected`

### 1.4 确认配置

确保 `~/.openclaw/config.yaml` 中配置了钉钉：

```yaml
channels:
  dingtalk:
    appKey: "your-app-key"
    appSecret: "your-app-secret"
    robotCode: "your-robot-code"
```

---

## 2. 测试顺序总览

按风险从低到高排列：

| 顺序 | 模块 | 风险 | 权限要求 |
|------|------|------|----------|
| ① | CLI 命令 | 低 | 无 |
| ② | Heartbeat 健康检查 | 低 | 无 |
| ③ | Hooks 日志 | 低 | 无 |
| ④ | Mentions 清理 | 低 | 无 |
| ⑤ | Actions: send | 中 | 基础 |
| ⑥ | Actions: broadcast | 中 | 基础 |
| ⑦ | Actions: sendAttachment | 中 | 基础 |
| ⑧ | Actions: member-info | 低 | 基础 |
| ⑨ | 后台服务 (session cleanup) | 低 | 无 |
| ⑩ | 重连修复 | 中 | 无 |
| ⑪ | 群管理 (rename/add/remove) | 高 | 群管理权限 |
| ⑫ | 消息操作 (recall/read/pin) | 高 | 消息权限 |
| ⑬ | 审批流 | 高 | 审批权限 |
| ⑭ | 考勤 | 高 | 考勤权限 |
| ⑮ | 日程 | 高 | 日程权限 |
| ⑯ | 文档 | 高 | 文档权限 |
| ⑰ | HTTP 回调路由 | 中 | 网络配置 |

---

## 3. 基础测试

### 3.1 CLI 命令

#### T-CLI-01: `openclaw dingtalk status`

**步骤**:
```bash
openclaw dingtalk status
```

**预期**:
- 显示 `=== DingTalk Account: xxx ===`
- 显示 `Status: ✅ Connected` 或 `❌ Error`
- 显示 App Key 前缀、Robot Code、Active Sessions 数

#### T-CLI-02: `openclaw dingtalk groups`

**步骤**:
```bash
openclaw dingtalk groups
```

**预期**:
- 列出已知群组 ID 和名称
- 如无群组历史，显示 `No known groups.`

#### T-CLI-03: `openclaw dingtalk send`

**步骤**:
```bash
openclaw dingtalk send <你的staffId> "CLI测试消息"
```

**预期**:
- 输出 `✅ Message sent (queryKey: xxx)`
- 钉钉收到消息

---

### 3.2 Heartbeat 健康检查

#### T-HB-01: 正常状态检查

**步骤**: Gateway 正常运行后，在 agent 会话中触发 heartbeat（或等待自动 heartbeat）。

**预期**: heartbeat 返回 `ok: true, reason: "stream connected"`

#### T-HB-02: 凭证未配置场景

**步骤**: 临时移除 config 中的 appKey/appSecret，重启后观察。

**预期**: heartbeat 返回 `ok: false, reason: "DingTalk credentials not configured"`

---

### 3.3 Hooks 日志

#### T-HOOK-01: 消息接收钩子

**步骤**: 在钉钉中向机器人发送一条消息。

**预期**: Gateway 日志中出现：
```
[dingtalk:hook] message_received | DM | from=xxx | account=default | 消息内容预览
```

#### T-HOOK-02: 消息发送钩子

**步骤**: 让 agent 回复一条消息。

**预期**: Gateway 日志中出现：
```
[dingtalk:hook] message_sending | to=xxx | account=default | 回复内容预览
```

如果回复包含 markdown 格式，还应出现：
```
[dingtalk:hook] message_sending | markdown detected
```

#### T-HOOK-03: Gateway 生命周期钩子

**步骤**: 重启 gateway。

**预期**: 日志中出现 `gateway_start` 和 `gateway_stop` 记录。

---

### 3.4 Mentions 清理

#### T-MEN-01: 普通 @机器人

**步骤**: 在群中发送 `@机器人名 你好`

**预期**: agent 收到的消息为 `你好`（@机器人名 及特殊空格 `\u2005` 被清除）

#### T-MEN-02: 多个 @

**步骤**: 在群中发送 `@机器人名 @其他人 请帮忙`

**预期**: 机器人名被清除，其他 @保留，最终文本干净无多余空格

#### T-MEN-03: 仅 @机器人无其他文本

**步骤**: 发送仅包含 `@机器人名` 的消息

**预期**: agent 收到空字符串或被正确处理（不崩溃）

---

### 3.5 后台服务

#### T-SVC-01: Session 清理

**步骤**: 启动后等待 5 分钟，观察日志。

**预期**: 如有过期 session，日志中出现：
```
[DingTalk][Service] Cleaned up N expired sessions
```
如无过期 session，无额外输出（正常行为）。

---

### 3.6 重连修复

#### T-MON-01: 短暂断网恢复

**步骤**:
1. 正常运行中，模拟断网：`iptables -A OUTPUT -d api.dingtalk.com -j DROP`
2. 等待 10–30 秒，观察日志
3. 恢复网络：`iptables -D OUTPUT -d api.dingtalk.com -j DROP`

**预期**:
- 日志出现 `dingtalk: connection lost, reconnect attempt #1`
- 恢复后出现 `dingtalk: connection restored after Ns`
- 之后消息收发正常

#### T-MON-02: 长时间断网 → 硬重连

**步骤**:
1. 断网超过 30 秒（超过 2 次软重连后）
2. 观察日志

**预期**:
- 软重连 2 次后日志出现 `performing hard reconnect`
- 硬重连创建全新客户端，token 缓存被清除
- 恢复后消息正常

#### T-MON-03: 去重验证

**步骤**: 在重连过程中发送消息，观察是否有重复处理。

**预期**: 日志出现 `duplicate message xxx, skipping`（如有重复投递）

---

## 4. 进阶测试

### 4.1 Actions: 消息发送

#### T-ACT-01: send — 发送文本消息

**步骤**: 使用 message 工具：
```json
{
  "action": "send",
  "target": "user:<staffId>",
  "message": "测试消息"
}
```

**预期**: 目标用户在钉钉收到文本消息，返回 `{ ok: true, processQueryKey: "..." }`

#### T-ACT-02: send — 发送 Markdown 消息

**步骤**:
```json
{
  "action": "send",
  "target": "<conversationId>",
  "title": "通知",
  "message": "**重要** 消息内容"
}
```

**预期**: 群内收到 markdown 格式消息

#### T-ACT-03: send — 缺少 target

**步骤**:
```json
{
  "action": "send",
  "message": "无目标"
}
```

**预期**: 返回 `{ error: "Missing required parameter: target (or to)" }`

#### T-ACT-04: broadcast — 群发

**步骤**:
```json
{
  "action": "broadcast",
  "targets": ["user:<id1>", "user:<id2>"],
  "message": "群发测试"
}
```

**预期**: 两个目标都收到消息，返回 `{ ok: true, sent: 2, failed: 0 }`

#### T-ACT-05: sendAttachment — 发送文件

**步骤**:
```json
{
  "action": "sendAttachment",
  "target": "user:<staffId>",
  "filePath": "/tmp/test.txt"
}
```

**前提**: `/tmp/test.txt` 存在

**预期**: 目标收到文件消息

#### T-ACT-06: member-info — 查询成员

**步骤**:
```json
{
  "action": "member-info",
  "groupId": "<conversationId>"
}
```

**预期**: 返回群成员列表（被动追踪的）和成员数量

---

### 4.2 群管理（需要群管理权限）

> **前提**: 钉钉应用已开通「群会话管理」权限，机器人为群管理员

#### T-GM-01: 重命名群

**步骤**:
```json
{
  "action": "renameGroup",
  "groupId": "<chatId>",
  "name": "测试群-已改名"
}
```

**预期**: 群名称变更，返回 `{ ok: true }`

#### T-GM-02: 添加群成员

**步骤**:
```json
{
  "action": "addParticipant",
  "groupId": "<chatId>",
  "userIds": ["<staffId>"]
}
```

**预期**: 用户被加入群聊

#### T-GM-03: 移除群成员

**步骤**:
```json
{
  "action": "removeParticipant",
  "groupId": "<chatId>",
  "userId": "<staffId>"
}
```

**预期**: 用户被移出群聊

---

### 4.3 消息操作（需要消息管理权限）

#### T-MO-01: 撤回消息

**步骤**:
1. 先发送一条消息，记录返回的 `processQueryKey`
2. 调用：
```json
{
  "action": "unsend",
  "processQueryKey": "<key>",
  "openConversationId": "<id>"
}
```

**预期**: 消息被撤回，钉钉中显示「消息已撤回」

#### T-MO-02: 查询已读回执

**步骤**:
```json
{
  "action": "read",
  "taskId": "<taskId>",
  "agentId": "<agentId>"
}
```

**前提**: 需要有通过工作通知发送的消息的 taskId

**预期**: 返回 `readUserIdList` 和 `unreadUserIdList`

#### T-MO-03: 置顶消息

**步骤**:
```json
{
  "action": "pin",
  "messageId": "<id>",
  "openConversationId": "<id>"
}
```

**预期**: 当前返回 `{ ok: false, message: "Message pinning is not yet supported..." }`（stub 实现）

---

### 4.4 审批流（需要审批权限）

> **前提**: 钉钉后台已开通「审批」权限，且已创建审批模板

#### T-APR-01: 发起审批

**步骤**: 使用 `dingtalk_create_approval` 工具：
```json
{
  "processCode": "<模板processCode>",
  "originatorUserId": "<发起人staffId>",
  "deptId": 1,
  "formComponentValues": [
    { "name": "请假类型", "value": "年假" },
    { "name": "开始时间", "value": "2026-02-11" },
    { "name": "结束时间", "value": "2026-02-12" }
  ]
}
```

**预期**: 返回 `processInstanceId`，钉钉中出现新审批实例

#### T-APR-02: 查询审批详情

**步骤**: 使用 `dingtalk_query_approval` 工具：
```json
{
  "processInstanceId": "<上一步返回的ID>"
}
```

**预期**: 返回审批详情（标题、状态、表单值、操作记录等）

#### T-APR-03: 列出审批实例

**步骤**:
```json
{
  "processCode": "<processCode>",
  "startTime": 1707580800000
}
```

**预期**: 返回审批实例 ID 列表

---

### 4.5 考勤（需要考勤权限）

> **前提**: 钉钉后台已开通「考勤」相关权限

#### T-ATT-01: 查询打卡记录

**步骤**: 调用 `getAttendanceRecords`（通过 agent 工具或直接测试）：
```
userIds: ["<staffId>"]
checkDateFrom: "2026-02-01 00:00:00"
checkDateTo: "2026-02-10 23:59:59"
```

**预期**: 返回打卡记录数组，包含 `userCheckTime`, `checkType`, `locationResult` 等

#### T-ATT-02: 查询考勤结果

**步骤**: 调用 `getAttendanceResults`：
```
workDateFrom: "2026-02-01 00:00:00"
workDateTo: "2026-02-10 23:59:59"
userIdList: ["<staffId>"]
```

**预期**: 返回考勤结果（正常/迟到/缺卡等状态）

---

### 4.6 日程（需要日程权限）

> **前提**: 钉钉后台已开通「日程」权限

#### T-CAL-01: 创建日程

**步骤**: 调用 `createCalendarEvent`：
```json
{
  "userId": "<unionId>",
  "summary": "测试会议",
  "start": { "dateTime": "2026-02-11T10:00:00+08:00", "timeZone": "Asia/Shanghai" },
  "end": { "dateTime": "2026-02-11T11:00:00+08:00", "timeZone": "Asia/Shanghai" },
  "description": "自动化测试创建"
}
```

**预期**: 返回 `CalendarEvent` 对象，钉钉日历中出现新日程

#### T-CAL-02: 查询日程列表

**步骤**: 调用 `listCalendarEvents`：
```json
{
  "userId": "<unionId>",
  "timeMin": "2026-02-10T00:00:00+08:00",
  "timeMax": "2026-02-12T00:00:00+08:00"
}
```

**预期**: 返回日程事件数组

#### T-CAL-03: 查询忙闲状态

**步骤**: 调用 `getSchedule`：
```json
{
  "userId": "<unionId>",
  "userIds": ["<unionId1>", "<unionId2>"],
  "startTime": "2026-02-11T00:00:00+08:00",
  "endTime": "2026-02-12T00:00:00+08:00"
}
```

**预期**: 返回各用户的忙闲时间段

---

### 4.7 文档（需要文档权限）

> **前提**: 钉钉后台已开通「文档」权限，已有知识库 workspaceId

#### T-DOC-01: 创建文档

**步骤**: 调用 `createDocument`：
```json
{
  "workspaceId": "<workspaceId>",
  "name": "测试文档",
  "docType": "alidoc",
  "operatorId": "<unionId>"
}
```

**预期**: 返回 `DocumentInfo`（含 nodeId, url）

#### T-DOC-02: 列出文档

**步骤**: 调用 `listDocuments`：
```json
{
  "workspaceId": "<workspaceId>",
  "operatorId": "<unionId>"
}
```

**预期**: 返回文档节点列表

---

### 4.8 HTTP 回调路由

#### T-HTTP-01: 正常回调

**步骤**:
```bash
curl -X POST http://localhost:<port>/dingtalk/callback \
  -H "Content-Type: application/json" \
  -d '{"EventType": "check_url", "timestamp": "123"}'
```

**预期**: 返回 `{"success": true}`，日志出现 `Received callback event: check_url`

#### T-HTTP-02: 非 POST 请求

**步骤**:
```bash
curl http://localhost:<port>/dingtalk/callback
```

**预期**: 返回 405 `Method not allowed`

#### T-HTTP-03: 签名验证（如已配置 appSecret）

**步骤**: 发送带错误签名的请求

**预期**: 返回 403 `Invalid signature`

---

## 5. 回归与稳定性测试

### T-REG-01: 现有功能不受影响

**步骤**:
1. 在群中 @机器人 发送问题，验证正常回复
2. 使用 `dingtalk_send_card` 工具发送 ActionCard
3. 使用 `dingtalk_mention` 工具 @人

**预期**: 所有现有功能正常工作

### T-REG-02: 多账户支持

**步骤**: 如配置了多个钉钉账户，分别测试每个账户的 status 和 send。

**预期**: 各账户独立工作

### T-REG-03: 长时间运行稳定性

**步骤**: 保持 Gateway 运行 24 小时以上。

**观察**:
- 内存是否持续增长
- session cleanup 是否正常执行
- 临时文件是否被清理
- 连接是否稳定

---

## 权限清单

| 能力 | 钉钉权限名称 | 权限代码 |
|------|-------------|---------|
| 消息发送 | 企业内机器人发送消息 | 基础 |
| 群管理 | 群会话管理 | `qyapi_chat_manage` |
| 消息撤回 | 机器人消息撤回 | 基础 |
| 审批 | 审批流程管理 | `Contact-r / Attendance-r / Process-rw` |
| 考勤 | 考勤信息读取 | `Attendance-r` |
| 日程 | 日程管理 | `Calendar-rw` |
| 文档 | 文档管理 | `Doc-rw` |

---

## 测试结果记录模板

| 测试编号 | 结果 | 备注 | 日期 |
|---------|------|------|------|
| T-CLI-01 | ⬜ | | |
| T-CLI-02 | ⬜ | | |
| T-CLI-03 | ⬜ | | |
| T-HB-01 | ⬜ | | |
| T-HB-02 | ⬜ | | |
| T-HOOK-01 | ⬜ | | |
| T-HOOK-02 | ⬜ | | |
| T-HOOK-03 | ⬜ | | |
| T-MEN-01 | ⬜ | | |
| T-MEN-02 | ⬜ | | |
| T-MEN-03 | ⬜ | | |
| T-SVC-01 | ⬜ | | |
| T-MON-01 | ⬜ | | |
| T-MON-02 | ⬜ | | |
| T-MON-03 | ⬜ | | |
| T-ACT-01 | ⬜ | | |
| T-ACT-02 | ⬜ | | |
| T-ACT-03 | ⬜ | | |
| T-ACT-04 | ⬜ | | |
| T-ACT-05 | ⬜ | | |
| T-ACT-06 | ⬜ | | |
| T-GM-01 | ⬜ | | |
| T-GM-02 | ⬜ | | |
| T-GM-03 | ⬜ | | |
| T-MO-01 | ⬜ | | |
| T-MO-02 | ⬜ | | |
| T-MO-03 | ⬜ | | |
| T-APR-01 | ⬜ | | |
| T-APR-02 | ⬜ | | |
| T-APR-03 | ⬜ | | |
| T-ATT-01 | ⬜ | | |
| T-ATT-02 | ⬜ | | |
| T-CAL-01 | ⬜ | | |
| T-CAL-02 | ⬜ | | |
| T-CAL-03 | ⬜ | | |
| T-DOC-01 | ⬜ | | |
| T-DOC-02 | ⬜ | | |
| T-HTTP-01 | ⬜ | | |
| T-HTTP-02 | ⬜ | | |
| T-HTTP-03 | ⬜ | | |
| T-REG-01 | ⬜ | | |
| T-REG-02 | ⬜ | | |
| T-REG-03 | ⬜ | | |
