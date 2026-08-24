---
title: dsh-channels Telegram + DeepSeek Harness 最终能力补齐执行方案
summary: 基于 wsz987/dsh-channels main HEAD f085a55、DeepSeek Harness dsh-v0.1.1-rc.2 与 Telegram Bot API 10.2 的最终 as-built 核验。覆盖架构判断、Attachment Gateway、Telegram P0/P1 能力缺口、逐文件改造、自动测试、TG×Harness Live Gate、PR 与发布 Gate。
status: final-execution-plan
repository: https://github.com/wsz987/dsh-channels
audited_head: f085a55f4c40aaafd67c4e310a3f3547e08cc760
harness_baseline: dsh-v0.1.1-rc.2
telegram_baseline: Bot API 10.2
node_baseline: "^22.19.0 || >=24.0.0"
date: 2026-08-23
---

# dsh-channels Telegram + DeepSeek Harness 最终能力补齐执行方案

> 本文是最终执行版，不是功能概览。
>
> 它回答四个问题：
>
> 1. 当前最新 `dsh-channels` 架构是否仍符合 DeepSeek Harness；
> 2. 最新 Attachment Gateway 变更后，哪些旧结论已经过时；
> 3. Telegram Channel 现在到底还缺哪些常用能力；
> 4. 开发者/AI 应按什么文件、什么顺序、什么测试标准执行，才能把 Telegram 收口为可日常使用的 Harness Agent Channel。

---

# 0. 最终结论

当前项目**不需要推翻重构**。

建议继续保持：

```text
Messaging Platform
      ↓
Upstream Driver
      ↓
Channel Adapter
      ↓
Channel Core Contract
      ↓
channel-harness
      ↓
DeepSeek Harness public APIs
```

当前最新代码已经正确解决了三类核心边界：

```text
Harness Agent/Session/Question
→ 只在 channel-harness

平台协议
→ 只在 channel-* adapter / upstream

附件传输
→ Channel Transport

附件理解
→ Harness / Skill / MCP / 独立 plugin
```

最新 `f085a55` 的 Attachment Gateway 方向是合理的，不建议回退。

下一阶段重点：

```text
P0：修真实交互正确性与 release blocker
P1：补 Telegram 日常高频功能
P2：只做明确有价值的增强
Live Gate：真实 TG × Harness 闭环
```

不要继续追求：

```text
Telegram Bot API 100% 覆盖
```

目标应定义为：

> **面向 DeepSeek Harness Agent 的完整 Telegram Channel，而不是 Telegram Bot Framework。**

---

# 1. 本次核验基线

## 1.1 最新仓库

本次重新查询 `main`，当前 HEAD：

```text
f085a55f4c40aaafd67c4e310a3f3547e08cc760
feat(channels): implement attachment gateway migration
```

这意味着上一版方案中以下结论已经过时：

```text
“Telegram audio/video inbound 只保留 resourceRef”
```

最新实现已经改为：

```text
photo
document
audio
voice
video
   ↓
file_id / resourceRef
   ↓
getFile
   ↓
download
   ↓
localData
   ↓
emit MessageReceived
```

Telegram 当前声明：

```ts
media: {
  inbound: {
    image: 'bytes',
    file: 'bytes',
    audio: 'bytes',
    video: 'bytes',
  },
  outbound: {
    image: 'bytes',
    file: 'bytes',
    audio: 'bytes',
    video: 'bytes',
  },
}
```

因此本方案：

```text
不再把 audio/video hydration 列为待办。
```

---

## 1.2 Harness baseline

当前 `channel-harness` 已迁移：

```text
DeepSeek Harness 0.1.1-rc.2
```

项目根：

```text
Node ^22.19.0 || >=24.0.0
```

已有治理：

```bash
pnpm check:harness-compat
pnpm check:harness-newer
```

保持：

```text
0.5.x
→ 只面向 0.1.1-rc.2 baseline
```

不要继续承担：

```text
0.1.0-rc.7 runtime compatibility
```

如果需要旧用户过渡：

```text
0.4.x = legacy maintenance line
0.5.x = rc.2 baseline
```

比在同一运行时代码里堆版本分支更干净。

---

# 2. DeepSeek Harness 官方能力重新核验

---

# 2.1 User Questions

Harness `0.1.1-rc.2`：

```text
ctx.userQuestions
```

仍然是：

```text
one active UserQuestionProvider
```

官方约束：

```text
registerProvider()
如果已有 provider
→ DUPLICATE_PROVIDER
```

因此下面方案仍然错误：

```text
Web Provider
+
Telegram Provider
同时 registerProvider()
```

当前项目已经改成更合理的：

```text
Web profile
  ↓
official Host ApiProxy mux
  ↓
QuestionInteractionBackend
  ↓
ChannelQuestionPresenter
  ↓
Channel Adapter

headless
  ↓
official UserQuestionProvider
  ↓
QuestionInteractionBackend
  ↓
ChannelQuestionPresenter
```

结论：

> 当前 Question 架构符合 Harness rc.2，不要改回“Telegram 自己注册 Provider”。

---

# 2.2 ApiProxy question

官方 Host 的 rc.2 question 路径是：

```text
ctx.userQuestions.ask()
         ↓
question/requested
         ↓
ApiProxy events.mux()
         ↓
UI / client
         ↓
api.respond()
         ↓
question/resolved
```

当前 `channel-harness/src/interactions/` 已拆为：

```text
question-backend.ts
question-apiproxy-backend.ts
question-direct-backend.ts
question-presenter.ts
question-state.ts
```

这是正确分层。

职责应继续保持：

```text
backend
= Harness transport / official semantics

presenter
= Channel UI / buttons / text answer / timeout

adapter
= 平台展示 + callback

core
= platform-neutral interaction contract
```

---

# 2.3 Harness Attachment

官方 `0.1.1-rc.2` `@deepseek-ai/dsh-attachment` 当前 durable attachment vocabulary 是：

```text
ImageAttachmentRef
SaveImageAttachment
StoredImageAttachment
RequestImageAttachment
```

支持 media type：

```text
image/png
image/jpeg
image/webp
image/gif
```

没有看到官方 generic：

```text
FileAttachmentRef
saveFile()
AudioAttachmentRef
VideoAttachmentRef
FileBlock
```

因此当前项目的最新 Attachment Gateway 判断是正确的：

```text
图片
→ 尽量走 Harness 官方 image attachment

PDF/DOCX/XLSX/TXT/audio/video
→ ChannelAttachmentProvider compatibility backend
```

---

# 2.4 Attachment 层职责

正式维持：

```text
Channel Attachments
=
transport
+
persistence
+
Session ACL

≠
content understanding
```

Channel 层负责：

```text
下载/解密
byte cap
MIME hint
持久化
Session ACL
stable attachment id
```

不负责新增：

```text
ASR
OCR
视频理解
PPTX理解
LLM文档总结
```

这些属于：

```text
Harness native future capability
Skill
MCP
独立 plugin
模型 provider
```

这与“Channel 只负责传递，理解交给 Harness/Skill”的长期方向一致。

---

# 3. 最新 Attachment Gateway 架构评价

最新代码新增：

```text
capabilities.media
```

定义：

```text
Inbound:
bytes | locator | unsupported

Outbound:
bytes | unsupported
```

这是比旧：

```text
image: true
audio: true
```

更精确的模型。

例如：

```text
audio: true
```

只能表达：

```text
平台“能处理 audio”
```

无法回答：

```text
Inbound 有没有真实 bytes？
Outbound 能不能上传 bytes？
```

新模型可以：

```ts
media: {
  inbound: {
    audio: 'bytes'
  },
  outbound: {
    audio: 'unsupported'
  }
}
```

结论：

> `capabilities.media` 设计合理，建议保留旧 boolean 一个兼容周期后再讨论清理，不要现在删除。

---

# 3.1 Provider rename

最新：

```text
ChannelFileProvider
↓
ChannelAttachmentProvider
```

并保留：

```text
ChannelFileProvider
ChannelFileContext
ChannelFileDescriptor
```

为 deprecated alias。

这是合理的兼容策略。

建议：

```text
0.5.x
保留 deprecated aliases

0.6/1.0 前
先统计 ecosystem 使用

再决定删除
```

不要当前版本直接删旧名。

---

# 3.2 channel-files

当前定位：

```text
Generic Attachment compatibility backend
```

而不是：

```text
文件理解引擎
```

正确。

建议继续保留：

```text
legacy PDF/DOCX/XLSX/TXT extraction
```

但停止扩大：

```text
ASR
视频分析
OCR pipeline
PPTX AI parser
```

原因：

```text
compat parser
≠
Channel transport core
```

---

# 3.3 README 文档漂移

这里发现一个需要立即修正的文档问题。

最新代码已经：

```text
audio/video → localData hydration
```

但 `packages/channel-telegram/README.md` 仍写：

```text
Inbound media hydration downloads image and document bytes;
audio/video keep resourceRef placeholder in V1.
```

这已经过时。

应修改成：

```text
Inbound image/file/audio/video are hydrated through getFile/downloadFile
when the adapter declares inbound media='bytes'.
Failures preserve resourceRef + ingressFailure.
```

这属于：

```text
P0 docs-as-contract drift
```

因为用户/AI 会根据 README 设计错误方案。

---

# 4. 当前 Telegram as-built 能力

截至最新 HEAD：

| 能力 | 状态 |
| --- | --- |
| text inbound/outbound | ✅ |
| photo/image | ✅ |
| file/document | ✅ |
| audio | ✅ bytes hydration |
| voice inbound | ✅ → AudioPart + bytes |
| video | ✅ bytes hydration |
| media directional capability | ✅ |
| Rich Markdown | ✅ |
| HTML | ✅ |
| MarkdownV2 escaped mode | ✅ |
| plain | ✅ |
| format-only fallback | ✅ |
| 401/403/429/network/5xx classification | ✅ |
| DM Rich Draft | ✅ |
| group edit streaming | ✅ |
| rich final | ✅ |
| partial Markdown offline tests | ✅ |
| code fence segmentation | ✅ |
| table segmentation | ✅ |
| emoji / ZWJ grapheme | ✅ |
| >4096 rolling preview | ✅ |
| >32768 rich split | ✅ |
| inline keyboard | ✅ |
| callback_query | ✅ |
| callback ACK | ✅ |
| callback_data 64-byte gate | ✅ |
| interaction.received | ✅ |
| adapter.edit | ✅ |
| ask_user_question backend | ✅ |
| single select | ✅ |
| multi select | ✅ logic |
| custom text | ✅ logic |
| skip | ✅ |
| timeout | ✅ |
| sender isolation | ✅ |
| ordinary Forum thread | ✅ |
| SessionBinding per conversation/thread | ✅ |
| TG reactions | ❌ |
| command menu | ❌ |
| typing | ❌ TG side |
| ForceReply full flow | ❌ |
| album aggregation | ❌ |
| sendMediaGroup | ❌ |
| voice-note outbound | ❌ |
| sticker | ❌ |
| animation/GIF | ❌ |
| video note | ❌ |
| location TG mapping | ❌ |
| contact | ❌ |
| ephemeral group question | ❌ |
| hosted webhook | ❌ |

---

# 5. P0 — 发布前必须收口

P0 不是“新增酷功能”。

P0 是：

> 当前已经宣称/依赖的能力，在真实 TG × Harness 中不能有结构性错误。

---

# P0-1 `SendResult.messageId` 必须完整透传

## 问题

当前 Question Presenter：

```ts
const result = await adapter.send(...)
pending.messageId = result.messageId
```

后续依赖：

```text
messageId
↓
multi-select edit
↓
remove buttons
↓
timeout cleanup
```

但 Telegram `OutboundSender.send()` 当前主要：

```ts
return {
  delivered: true,
  raw: response
}
```

没有稳定：

```ts
messageId
```

---

## 风险

真实 TG：

```text
请选择：

[Code]
[Docs]
[完成]
```

点 `Code`：

预期：

```text
✓ Code
Docs
完成
```

实际上可能：

```text
无法 edit 原消息
→ 新发一条
→ 原按钮仍可点击
```

timeout：

```text
旧按钮可能继续留着
```

---

## 改法

统一 upstream 返回：

```ts
export interface TelegramSentMessage {
  messageId: string
  raw: unknown
}
```

覆盖：

```text
sendMessage
sendRichMessage
sendPhoto
sendDocument
sendAudio
sendVideo
后续 sendVoice/sendAnimation/...
```

所有 Bot API 返回 Message 的接口：

```text
parseEnvelope
↓
validate result.message_id
↓
TelegramSentMessage
```

---

## OutboundSender

最终：

```ts
return {
  delivered: true,
  messageId: result.messageId,
  raw: result.raw,
}
```

---

## 分段文本

如果：

```text
text > limit
+
actions
```

按钮不能挂每一段。

应该：

```text
chunk1
chunk2
chunk3 [buttons]
```

最终：

```text
SendResult.messageId = chunk3.messageId
```

也就是：

> `messageId` 永远指向真正承载交互 controls 的那条消息。

---

## 修改文件

```text
packages/channel-telegram/src/upstream.ts
packages/channel-telegram/src/outbound.ts
packages/channel-telegram/src/rich-message.ts
packages/channel-telegram/test/interaction.test.ts
packages/channel-telegram/test/adapter.test.ts
packages/channel-harness/test/question*.test.ts
```

---

## Done

```text
single select
multi select
custom
timeout
external resolved
```

都能：

```text
更新/清理同一条 Telegram message
```

---

# P0-2 callback Forum Topic thread identity

## 当前

普通 message：

```text
message_thread_id
→ conversation.threadId
```

已经正确。

callback schema：

```text
callback_query.message
```

当前没有稳定映射：

```text
message_thread_id
```

---

## 风险

```text
Group G / Topic 100
Harness question
↓
button
↓
callback event thread=''
↓
pending key = G:100
callback key = G:''
↓
不匹配
```

---

## 改法

callback schema：

```ts
message: z.object({
  message_id: z.number(),
  message_thread_id: z.number().optional(),
  chat: ...
})
```

mapper：

```ts
conversation: {
  id,
  type,
  ...(cq.message?.message_thread_id !== undefined
    ? { threadId: String(cq.message.message_thread_id) }
    : {})
}
```

---

## Tests

Fixture：

```text
group callback no topic
forum callback topic=123
wrong topic callback
```

Harness：

```text
Topic A question
→ Topic A callback resolve

Topic B callback
→ cannot resolve Topic A
```

---

# P0-3 ordinary message 完整 Zod trust boundary

## 当前风险

普通 mapper 仍然：

```ts
const update = raw as TelegramRawUpdate
```

callback 已经部分 Zod。

这会导致：

```text
普通 message 与 callback 的 trust level 不一致
```

README 也把它标成 release blocker。

---

## 目标

建立：

```text
telegramUserSchema
telegramChatSchema
telegramPhotoSchema
telegramDocumentSchema
telegramAudioSchema
telegramVoiceSchema
telegramVideoSchema
telegramMessageSchema
telegramMessageUpdateSchema
```

允许：

```ts
.passthrough()
```

以兼容 Bot API 新字段。

但 identity 必须严格：

```text
message_id
chat.id
chat.type
from.id
```

---

## chat type

当前代码：

```text
group/supergroup → group
其它 → dm
```

不要继续把：

```text
unknown/channel
```

自动降成：

```text
dm
```

建议：

```text
private → dm
group/supergroup → group
其它 → unsupported/reject canonical message
```

因为：

> unknown platform identity 不能被误解释成一个更高权限的 DM。

---

## sender

不要 fabricate：

```text
sender='unknown'
```

再让后续逻辑猜。

理想：

```text
invalid identity
→ mapper failure / canonical rejection
→ Access Gate 不产生本地副作用
```

---

## 修改

```text
packages/channel-telegram/src/mapper.ts
packages/channel-telegram/src/inbound.ts
fixtures/telegram/*
packages/channel-telegram/test/adapter.test.ts
```

---

# P0-4 media send `ok` envelope 必须成为真值

README 当前仍标记：

```text
Media sends currently need same ok envelope validation
```

必须解决。

所有：

```text
sendPhoto
sendDocument
sendAudio
sendVideo
```

必须：

```text
HTTP resolved
≠
delivery succeeded
```

统一：

```text
post()
↓
parseEnvelope()
↓
if !ok
   TelegramApiError
↓
parse Message
↓
TelegramSentMessage
```

---

## 错误分类

继续复用：

```text
TelegramApiError
```

不要在 media 又新建：

```text
MediaTelegramError
```

---

## Tests

```text
HTTP 200 {ok:false,error_code:403}
→ reject permission

HTTP 200 {ok:false,error_code:429,parameters.retry_after}
→ rate-limit

HTTP 200 {ok:true,result:{message_id}}
→ delivered
```

---

# P0-5 multiple media 绝不 silent drop

## 当前

```ts
const media = firstMedia(message.parts)
```

一旦找到第一个：

```text
send
return
```

所以：

```text
image1
image2
image3
```

可能只发送：

```text
image1
```

这必须先修。

---

## P0 最低版本

即使还没做 album：

```text
collectSendableMedia(parts)
```

然后：

```text
0 → text
1 → send one
N → sequential send all
```

任何情况下：

```text
不 silent discard
```

如果组合不能发送：

```text
明确 throw unsupported
```

也比丢附件正确。

---

# P0-6 ForceReply + free-text correlation

## 当前

Question Presenter 已支持：

```text
custom text
```

但 Telegram UI 没真正建立可靠的：

```text
“这条文本是在回答哪个问题”
```

群里尤其危险。

---

## Core 建议

新增极窄 generic contract：

```ts
export interface OutboundReplyPrompt {
  kind: 'text'
  placeholder?: string
}

export interface OutboundMessage {
  ...
  replyPrompt?: OutboundReplyPrompt
}
```

不要加：

```ts
telegramForceReply
```

---

## Telegram

```text
replyPrompt
→ ForceReply
```

---

## Question flow

single-select：

```text
[pnpm] [npm] [yarn] [其他]
```

点：

```text
其他
```

流程：

```text
clear inline keyboard
↓
send NEW ForceReply prompt
↓
user replies to prompt
↓
consume as custom
```

不要：

```text
同一 reply_markup 同时塞 inline_keyboard + force_reply
```

---

## Group policy

DM：

```text
允许 reply-to
也允许 pending sender 的下一条文本（兼容体验）
```

Group / Forum：

```text
必须 replyTo === pending.promptMessageId
```

否则：

```text
普通群聊文字
≠
question answer
```

---

# P0-7 Question terminal state

当前已有：

```text
timeout
processing
responding
```

继续强化：

```text
pending
→ resolved
→ expired
→ aborted
→ externally-settled
```

terminal 后：

```text
任何 callback
任何 text
```

都不能重新推进 Harness。

---

## 必测

```text
重复点按钮
timeout 后点
外部 Web 回答后 TG 再点
agent abort 后再点
bridge stop 后再点
```

---

# P0-8 README / docs 同步

修改：

```text
packages/channel-telegram/README.md
docs/architecture.md
docs/compatibility-matrix.md（如包含 TG media）
```

至少修正：

```text
audio/video now hydrate to bytes
```

并更新 capability table：

```text
interactiveActions ✅
media directional ✅
```

---

# 6. P1 — Telegram 日常能力补齐

P0 全过后做。

---

# P1-1 Typing / sendChatAction

## Core

已经有：

```ts
startTyping?()
stopTyping?()
startTypingForTarget?()
stopTypingForTarget?()
```

不要新增 Core API。

---

## Telegram upstream

新增：

```ts
sendChatAction(
  chatId: string,
  action: 'typing',
  options?: { messageThreadId?: string }
): Promise<void>
```

---

## Adapter

实现：

```ts
startTypingForTarget(target)
stopTypingForTarget(target)
```

维护：

```ts
Map<TargetKey, TypingState>
```

Telegram typing 约 5 秒后会消失。

推荐：

```text
start
→ immediate sendChatAction
→ every 4s refresh

stop
→ clear timer
```

---

## Harness 启动点

必须在：

```text
Access Gate 通过之后
```

才能 typing。

推荐：

```text
authorized inbound
↓
resolve/create Agent
↓
ReplyContext register
↓
best effort startTyping
↓
agent.followup
```

禁止：

```text
unauthorized user
→ typing
```

因为这也是外部可观察 side effect。

---

## terminal

ReplyRouter 已有 stop typing 意图。

验证：

```text
turn/end
turn/error
no-output turn
cancel
bridge drain
```

都停止。

---

# P1-2 Bot Command Menu

目标：

Telegram 用户输入：

```text
/
```

看到 Harness command：

```text
/new
/help
/status
/stop
/models
/model
/version
...
```

---

## 架构

命令语义：

```text
Harness ctx.commands
```

Telegram 只展示。

不要：

```text
channel-telegram 自己 hardcode command meaning
```

---

## Generic seam

建议：

```ts
export interface ChannelCommandHint {
  name: string
  description: string
}

interface ChannelAdapter {
  syncCommandHints?(
    scope: ChannelTarget,
    commands: readonly ChannelCommandHint[],
  ): Promise<void>
}
```

Harness：

```text
ctx.commands.list(agent)
↓
ChannelCommandHint[]
↓
adapter.syncCommandHints
```

Telegram：

```text
setMyCommands
```

---

## caching

```text
scopeKey
+
stable command hash
```

无变化：

```text
不重复 setMyCommands
```

---

# P1-3 Media Group / Album

这是多模态 Agent 高频能力。

用户：

```text
一次发 5 张截图
caption:
“帮我比较”
```

目标：

```text
one Telegram album
→ one MessageReceived
→ one Harness turn
→ 5 ImagePart
```

不是：

```text
5 update
→ 5 Harness turns
```

---

## Inbound key

Album assembler key：

```text
accountId
chatId
threadId
senderId
media_group_id
```

不能只：

```text
media_group_id
```

---

## settle

推荐：

```text
250–500ms
```

配置：

```yaml
albums:
  aggregateInbound: true
  settleMs: 350
```

---

## 最难点：offset ACK

当前 polling：

```text
handle(update)
成功
→ cursor = update_id + 1
```

Album aggregation 会让：

```text
update 1 暂存
update 2 暂存
...
最后 flush
```

不能在真正 canonical emit 之前把 buffered update 永久 ack 掉。

---

## 推荐设计

引入：

```text
TelegramUpdateDispatcher
```

概念：

```text
raw update
↓
classify
├─ immediate update
└─ album member
```

维护：

```text
pending updates
committed contiguous offset
```

只有：

```text
canonical event emit success
```

才能 commit 对应 update。

---

## 简化方案

如果不想第一版改 cursor：

```text
Inbound album aggregation 先 P1.5
Outbound sendMediaGroup 先做
```

但最终要实现正确 ACK 语义。

---

## Outbound

Telegram album：

```text
2–10 items
```

策略：

```text
eligible 2–10
→ sendMediaGroup

1
→ ordinary send

>10
→ chunk groups

mixed unsupported
→ sequential
```

不能丢 part。

---

# P1-4 Voice Note

当前：

```text
voice inbound
→ AudioPart
```

但没有显式保留：

```text
这是 voice-note，而不是普通 audio。
```

---

## Core

建议给 binary 增加平台无关 presentation：

```ts
export type BinaryPresentation =
  | 'attachment'
  | 'voice-note'
  | 'video-note'
  | 'animation'
  | 'sticker'

interface BinaryPartBase {
  ...
  presentation?: BinaryPresentation
}
```

这不是 Telegram 专有。

---

## Inbound

```text
voice
→ AudioPart
  presentation='voice-note'
```

---

## Outbound

```text
AudioPart + voice-note
→ sendVoice

AudioPart default
→ sendAudio
```

---

# P1-5 Reaction

Core 已有：

```text
ReactionReceived
```

无需新事件。

---

## Telegram

getUpdates 增：

```text
message_reaction
```

map：

```text
ReactionReceived {
  messageId
  sender
  emoji
  added
}
```

outbound：

```text
setMessageReaction
```

---

## scope

reaction 第一版定位：

```text
UX
feedback
status
```

不要定义：

```text
👍 = tool approval
```

审批继续：

```text
Inline Keyboard / Question
```

---

# P1-6 Sticker

Inbound：

```text
sticker
```

映射建议：

```text
static webp
→ ImagePart
  presentation=sticker

video webm
→ VideoPart
  presentation=sticker

animated tgs
→ FilePart
  presentation=sticker
```

保留：

```text
emoji
set_name
```

可作为通用 metadata/alt，不把 raw JSON 给模型。

Outbound：

```text
presentation=sticker
→ sendSticker
```

---

# P1-7 Animation / GIF

Telegram：

```text
animation
```

Core 不新增：

```text
GifPart
```

映射：

```text
VideoPart
presentation='animation'
```

Outbound：

```text
sendAnimation
```

---

# P1-8 Video Note

Telegram 圆形视频：

```text
video_note
```

映射：

```text
VideoPart
presentation='video-note'
```

Outbound：

```text
sendVideoNote
```

---

# P1-9 Location / Contact

## Location

Core 已有：

```ts
LocationPart
```

因此成本很低。

mapper：

```text
message.location
→ LocationPart
```

outbound：

```text
LocationPart
→ sendLocation
```

---

## Contact

Core 当前无 ContactPart。

建议：

```ts
export interface ContactPart {
  type: 'contact'
  displayName?: string
  phoneNumber?: string
  userId?: string
}
```

Harness converter：

```text
[contact: <name> <phone>]
```

不要：

```text
raw Telegram contact object
```

---

# P1-10 Forum Topic 完整闭环

普通 message 已经有：

```text
threadId
```

要补全：

```text
callback
typing
ForceReply
album
question cleanup
media send
```

统一 target：

```text
channel
account
conversation
thread
```

---

## Live Gate

```text
Topic A → Session A
Topic B → Session B

A text ≠ B
A callback ≠ B
A custom reply ≠ B
A album ≠ B
```

---

# P1-11 Ephemeral Group Questions

这是推荐增强，不是基础 transport。

Telegram 10.2 可用：

```text
receiver_user_id
```

但不能假设：

```text
sendRichMessage
```

拥有完全相同 ephemeral surface。

---

## 架构

普通 group：

```text
Rich Question
```

ephemeral group：

```text
sendMessage
+
receiver_user_id
+
InlineKeyboard
```

后续：

```text
editEphemeralMessageText
editEphemeralMessageReplyMarkup
```

---

## fallback

必须：

```text
ephemeral fail
→ normal group question
```

原因：

```text
ephemeral delivery 不保证
```

不能导致：

```text
Harness 永远等待一个用户没收到的问题
```

---

# 7. P2 — 完整后再考虑

P0 + P1 后，Telegram 对 Harness 已基本完整。

剩余：

```text
my_chat_member
edited_message
webhook transport
rich media caption
link preview policy
poll
migrate_to_chat_id
```

---

# 7.1 `my_chat_member`

用途：

```text
bot kicked
bot permissions changed
bot joined
```

对 health 很有价值。

建议：

```text
P2 high
```

但不阻塞 Agent UI 基本完整。

---

# 7.2 edited_message

不要收到编辑就：

```text
重新驱动 Agent
```

风险：

```text
旧消息编辑
→ 重复执行副作用
```

如未来支持：

```text
message.updated
```

应单独设计 Core event。

---

# 7.3 webhook

当前：

```text
local/self-host
→ getUpdates
```

合理。

只有 SaaS / multi-instance 才优先 webhook。

---

# 8. 不纳入本轮

明确不做：

```text
Payments
Stars
Invoices
Games
Mini Apps
Passport
Business Account 全套
Admin/ban/unban
Giveaway
Paid Media
Join Requests
Community management
```

这些属于：

```text
Telegram product extension
```

不是：

```text
Harness messaging channel
```

---

# 9. 逐包改造计划

---

# 9.1 channel-core

## `src/messages.ts`

新增：

```text
OutboundReplyPrompt
ContactPart
BinaryPresentation
```

示例：

```ts
export type BinaryPresentation =
  | 'attachment'
  | 'voice-note'
  | 'video-note'
  | 'animation'
  | 'sticker'

export interface ContactPart {
  type: 'contact'
  displayName?: string
  phoneNumber?: string
  userId?: string
}

export interface OutboundReplyPrompt {
  kind: 'text'
  placeholder?: string
}
```

Binary：

```ts
interface BinaryPartBase {
  ...
  presentation?: BinaryPresentation
}
```

Outbound：

```ts
interface OutboundMessage {
  ...
  replyPrompt?: OutboundReplyPrompt
}
```

---

## 原则

不要加入：

```text
TelegramForceReply
TelegramSticker
TelegramVideoNote
```

---

## `src/adapter.ts`

已有 typing：

```text
不改
```

可新增：

```ts
syncCommandHints?
```

仅如果 command menu 跨渠道值得共用。

---

## `src/capabilities.ts`

保持：

```text
legacy bool
+
media directional
```

本轮不要删除 legacy boolean。

新增 capability 也要克制。

可以暂时：

```text
不新增 replyPrompt=true
```

因为 adapter 有 optional behavior 可自然降级。

---

# 9.2 channel-harness

## `src/interactions/question-presenter.ts`

本轮重点：

```text
messageId correctness
ForceReply prompt id
group reply-to
callback thread
terminal stale handling
ephemeral presented-message identity
```

建议将：

```ts
pending.messageId?: string
```

升级：

```ts
interface PresentedQuestionMessage {
  mode: 'regular' | 'ephemeral'
  messageId: string
  promptMessageId?: string
  receiverUserId?: string
}
```

---

## `src/interactions/question-state.ts`

显式 terminal：

```ts
type QuestionState =
  | 'pending'
  | 'resolved'
  | 'expired'
  | 'aborted'
  | 'externally-settled'
```

避免只靠 boolean 推断。

---

## `src/bridge.ts`

普通 followup 前：

```text
startTyping
```

必须：

```text
Access Gate 之后
```

---

## command menu

如果采用 generic hint：

```text
agent resolved
↓
ctx.commands.list(agent)
↓
normalize hints
↓
adapter.syncCommandHints?
```

注意：

```text
commands 是 Agent-scoped
```

所以不要只在 adapter startup 全局 set 一次。

---

## Attachment

继续：

```text
ChannelAttachmentProvider
```

不要把 TG media parsing 加进 Harness。

---

# 9.3 channel-telegram upstream

## `src/upstream.ts`

第一阶段修：

```text
sendRichMessage → TelegramSentMessage
sendMedia → TelegramSentMessage
media ok envelope
```

第二阶段加：

```text
sendChatAction
setMyCommands
sendMediaGroup
sendVoice
sendAnimation
sendSticker
sendVideoNote
sendLocation
sendContact
setMessageReaction
```

ephemeral：

```text
editEphemeralMessageText
editEphemeralMessageReplyMarkup
```

---

## 统一模板

每一个返回 Message 的方法：

```ts
const raw = await this.post(...)
const envelope = this.parseEnvelope(method, raw)

if (!envelope.data.ok) {
  throw this.apiError(method, envelope.data)
}

const sent = sentMessageSchema.safeParse(envelope.data.result)

if (!sent.success) {
  throw new ChannelError(...)
}

return {
  messageId: String(sent.data.message_id),
  raw: envelope.data,
}
```

不要 endpoint 各写一套。

---

# 9.4 mapper

## `src/mapper.ts`

优先重构：

```text
interface casts
↓
Zod schemas
```

新增内容：

```text
sticker
animation
video_note
location
contact
message_reaction
callback threadId
```

---

## Message kind precedence

建议：

```text
text
photo
document
audio
voice
video
animation
video_note
sticker
location
contact
unsupported
```

媒体 caption：

```text
text part first
media second
```

维持现有模型输入顺序。

---

# 9.5 inbound

## `src/inbound.ts`

已有：

```text
image/file/audio/video hydration
```

保留。

新增：

```text
album assembler
reaction handler
```

不要把理解放这里。

---

# 9.6 outbound

## `src/outbound.ts`

必须删除：

```text
firstMedia
```

替换：

```text
collectSendableMedia
```

---

## send pipeline

```text
message
↓
collect media
↓
0:
 render text

1:
 send one media

2-10 eligible:
 sendMediaGroup

otherwise:
 sequential sends
```

---

## actions

如果有：

```text
actions
```

必须只挂：

```text
承载最后交互的 message
```

`SendResult.messageId` 返回该条 id。

---

# 9.7 adapter

## `src/adapter.ts`

新增：

```text
typing timers
command hint hashes
```

stop：

```text
clear all timers
```

---

## capabilities

完成 reaction 后：

```ts
reactions: true
```

不要提前改。

---

# 9.8 config

推荐只加少量高价值配置。

```ts
interface TelegramTypingConfig {
  enabled: boolean
  refreshMs: number
}

interface TelegramAlbumConfig {
  aggregateInbound: boolean
  settleMs: number
}

interface TelegramQuestionPresentationConfig {
  ephemeralGroups: boolean
}
```

默认：

```yaml
typing:
  enabled: true
  refreshMs: 4000

albums:
  aggregateInbound: true
  settleMs: 350

questions:
  ephemeralGroups: true
```

如果第一版复杂：

```text
ephemeralGroups default false
```

等 live gate 后开启也可以。

---

# 10. 实施 Phase

---

# Phase 0 — 当前 HEAD 文档同步

修改：

```text
Telegram README audio/video hydration
capability table
known limits
```

不要让 AI 下一轮再读到旧结论。

---

# Phase 1 — Interaction correctness

任务：

```text
1. TelegramSentMessage 统一
2. SendResult.messageId
3. segmented action final-message semantics
4. callback threadId
5. ordinary Zod
6. media ok envelope
7. multi media sequential no-drop
```

这批不增加新产品能力。

目标：

> 让已经存在的 Rich + Question 真实可靠。

---

# Phase 2 — Question free text

任务：

```text
OutboundReplyPrompt
ForceReply
prompt message id
group reply-to enforcement
terminal stale callbacks
```

---

# Phase 3 — Typing

任务：

```text
sendChatAction
timer refresh
Harness start
terminal stop
Forum thread
```

---

# Phase 4 — Command Menu

任务：

```text
generic hints
Harness registry
setMyCommands
per-scope cache
```

---

# Phase 5 — Media completion

任务：

```text
sendMediaGroup
album assembler
voice-note
sticker
animation
video-note
location
contact
```

---

# Phase 6 — Reactions

任务：

```text
getUpdates reaction
mapper
ReactionReceived
setMessageReaction
```

---

# Phase 7 — Ephemeral question

最后做：

```text
receiver
ephemeral send
ephemeral edit
fallback
timeout
```

---

# Phase 8 — Live Gate

真实：

```text
DM
group
forum
Web same Session
media
question
network/error
```

---

# 11. 自动测试详细清单

---

# 11.1 Core

新增：

```text
BinaryPresentation serialization
ContactPart
OutboundReplyPrompt
legacy capability compatibility
directional media compatibility
```

---

# 11.2 Mapper

必须 fixture：

```text
text
photo
document
audio
voice
video
sticker static
sticker video
sticker tgs
animation
video_note
location
contact
forum message
forum callback
malformed sender
malformed chat
unsupported chat type
```

---

# 11.3 Media hydration

当前新增 Attachment Gateway 已有方向。

继续覆盖：

```text
photo bytes
document bytes
audio bytes
voice bytes
video bytes
too-large
download-failed
abort
mime fill
name preservation
```

---

# 11.4 Outbound messageId

```text
plain send returns id
rich send returns id
media send returns id
long send returns final id
question action message returns id
```

---

# 11.5 Multi media

```text
2 image no loss
3 file no loss
mixed image/file no loss
failure at item2 surfaces
never claims delivered when an item failed
```

---

# 11.6 ForceReply

```text
DM reply
DM next-text compatibility
group unrelated text
group correct replyTo
forum correct replyTo
wrong thread reply
```

---

# 11.7 Question terminal

```text
resolve once
duplicate callback
timeout
late callback
late text
external resolved
abort
bridge stop
```

---

# 11.8 Typing

fake timers：

```text
start immediate API call
4s refresh
8s refresh
stop no more
adapter.stop no leak
```

Harness：

```text
authorized starts
unauthorized doesn't
Web-origin doesn't start TG
turn/end stops
turn/error stops
```

---

# 11.9 Commands

```text
registered command hints
description
TG invalid name handling
no duplicate sync
changed registry sync
different scope
```

---

# 11.10 Album

Inbound：

```text
2 photos one event
5 photos + caption one event
different sender not grouped
different thread not grouped
different chat not grouped
timeout flush
emit fail ack behavior
restart/reconnect behavior
```

Outbound：

```text
2–10 eligible group
>10 split
1 ordinary
mixed fallback
message id semantics
```

---

# 11.11 Reaction

```text
add
remove
wrong sender
forum
does not enter model prompt
```

---

# 12. 本地命令 Gate

每个 PR：

```bash
pnpm --filter @wsz987/channel-core typecheck
pnpm --filter @wsz987/channel-core test

pnpm --filter @wsz987/channel-telegram typecheck
pnpm --filter @wsz987/channel-telegram test

pnpm --filter @wsz987/channel-harness typecheck
pnpm --filter @wsz987/channel-harness test
```

完整：

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm verify
pnpm check:fixtures
pnpm check:manifests
pnpm check:harness-compat
pnpm ci:check
```

发布前：

```bash
pnpm release:verify
```

---

# 13. TG × Harness Live Gate

这是最终最重要部分。

---

# Live 1 — Basic

TG：

```text
请回复 TG-HARNESS-OK
```

必须：

```text
TG → Harness → TG
```

---

# Live 2 — Rich

让 Agent 输出：

```text
heading
bold
italic
list
nested list
blockquote
link
code fence
table
CJK
emoji
```

检查：

```text
final rich 正确
```

---

# Live 3 — Partial streaming

让模型逐步生成代码。

观察：

```text
未闭合 ```
未完成 table
未完成 link
```

要求：

```text
streaming 不死
final rich 正确
```

---

# Live 4 — Long

```text
8K text
35K+ text
```

要求：

```text
preview 持续变化
无 frozen head
无丢字
无重复
code fence safe
table safe
emoji safe
```

---

# Live 5 — Single Question

Prompt Agent：

```text
我要创建 Node 项目。
如果有多个包管理器，请调用 ask_user_question 问我，
不要自己选择。
```

TG：

```text
[pnpm] [npm] [yarn]
```

点：

```text
pnpm
```

要求：

```text
Harness 原 tool Promise resolve
Agent 同一流程继续
```

不能：

```text
再创建一个新 user turn 来模拟答案
```

---

# Live 6 — Multi-select

Agent Question：

```text
请选择：
[Code]
[Docs]
[Tests]
[完成]
```

点：

```text
Code
Docs
完成
```

要求：

```text
同一 message ✓ 状态更新
resolve 一次
按钮最终清理
```

---

# Live 7 — Custom / ForceReply

点：

```text
其他
```

要求：

```text
TG 出 ForceReply
```

用户：

```text
bun
```

Harness：

```text
custom=bun
```

---

# Live 8 — Timeout

测试配置：

```yaml
timeoutMs: 10000
```

等待：

```text
10 sec
```

要求：

```text
question timeout
buttons removed/expired
```

15 sec 再点：

```text
无效
```

---

# Live 9 — Wrong sender

群里：

```text
A 发起 question
B 点按钮
```

要求：

```text
B cannot resolve
```

A 仍然能答。

---

# Live 10 — Group free text

A question 等自由文本。

A 在群里普通说：

```text
等我一下
```

没有 reply-to prompt：

```text
不得 consume
```

A reply-to question：

```text
使用 pnpm
```

才 consume。

---

# Live 11 — Forum

```text
Topic A
Topic B
```

各启动不同 Session/question。

要求：

```text
完全隔离
```

---

# Live 12 — TG/Web same session

架构回归最高优先级。

同一 Harness Session：

```text
TG-origin turn
→ question 去 TG

Web-origin turn
→ question 留 Web
```

只要：

```text
Web question 被发到 TG
```

整项 FAIL。

说明：

```text
错误使用 SessionBinding
而不是 turn ReplyContext provenance
```

---

# Live 13 — Typing

请求：

```text
请认真分析一个复杂问题
```

要求：

```text
Agent 真正工作前
TG 出 typing

长任务
typing 持续 refresh

turn 完成
停止
```

---

# Live 14 — Attachments

依次 TG 发送：

```text
image
PDF
TXT
audio
voice
video
```

日志确认：

```text
localData bytes
```

Harness：

图片：

```text
official image attachment
```

generic：

```text
ChannelAttachmentProvider descriptor
```

不要求 Channel 自动理解 audio/video。

---

# Live 15 — Album

发送：

```text
5 张截图 + caption
```

最终：

```text
one Harness user message
one turn
5 images
```

---

# Live 16 — Sticker/GIF/video-note/location/contact

分别发：

```text
sticker
GIF
video note
location
contact
```

要求：

```text
不再 unsupported
canonical part 正确
```

---

# Live 17 — Error truth

故意触发：

```text
format parse error
invalid token
bot removed
429
network disconnect
```

要求：

```text
format
→ one plain fallback

401
→ auth fail

403
→ permission

429
→ rate-limit

network
→ reconnect/error path
```

禁止：

```text
所有错误都 plain fallback
```

---

# 14. Attachment Gateway Live Gate

最新代码宣称 TG：

```text
image/file/audio/video inbound = bytes
```

因此必须用真实 Bot 验证。

如果任何一种：

```text
voice/video/audio
```

真实环境长期无法 produce `localData`：

不能继续声明：

```text
bytes
```

应暂时降：

```text
locator
```

原则：

> Capability 是可验证承诺，不是产品愿望。

---

# 15. Release blocker 优先级

## Blocker A

```text
SendResult.messageId
```

## Blocker B

```text
callback threadId
```

## Blocker C

```text
ordinary Zod
```

## Blocker D

```text
media ok envelope
```

## Blocker E

```text
multi media silent drop
```

## Blocker F

```text
TG README 与 Attachment Gateway 事实不一致
```

以上未解决：

```text
不要把 Telegram experimental 改成更高成熟度
```

---

# 16. 推荐 PR 拆分

## PR 1

```text
fix(channel-telegram): close outbound identity and media truth gaps
```

内容：

```text
TelegramSentMessage
SendResult.messageId
media ok envelope
multi media no drop
long actions final message
README hydration sync
```

---

## PR 2

```text
fix(channel-telegram): harden inbound update identity
```

内容：

```text
ordinary message Zod
callback threadId
chat type fail closed
fixtures
```

---

## PR 3

```text
feat(channels): add generic reply prompts
```

内容：

```text
OutboundReplyPrompt
TG ForceReply
Question Presenter reply correlation
```

---

## PR 4

```text
feat(channel-telegram): add typing activity
```

内容：

```text
sendChatAction
timer
Harness lifecycle
```

---

## PR 5

```text
feat(channels): expose command hints
```

内容：

```text
ChannelCommandHint
Harness registry
TG setMyCommands
```

---

## PR 6

```text
feat(channel-telegram): complete common Telegram media
```

内容：

```text
BinaryPresentation
voice
sticker
animation
video note
location/contact
sendMediaGroup
```

如果 album inbound ACK 改动大：

```text
单独 PR
```

---

## PR 7

```text
feat(channel-telegram): aggregate Telegram albums
```

内容：

```text
assembler
offset commit model
one Harness turn
```

---

## PR 8

```text
feat(channel-telegram): support reactions
```

---

## PR 9

```text
feat(channel-telegram): support ephemeral group questions
```

---

## PR 10

```text
test(channel-telegram): complete Bot API 10.2 live gate
```

---

# 17. 每个 PR 的 Done Definition

每个 PR 必须：

```text
typecheck
unit test
contract test
fixtures
no platform raw leakage
no Harness import in Telegram
no TG branch in core
```

如果涉及：

```text
Harness Bridge
```

必须额外：

```text
TG/Web origin isolation regression
Access Gate regression
SessionBinding regression
```

---

# 18. 0.5.x 最终 Done Definition

只有满足：

```text
Architecture
✅ no redline regression

Harness
✅ rc.2 compatibility
✅ questions
✅ command plane
✅ attachment boundary
✅ TG/Web origin isolation

Telegram P0
✅ all

Telegram common P1
✅ typing
✅ command menu
✅ album
✅ voice
✅ sticker
✅ animation
✅ video note
✅ location/contact
✅ reaction
✅ full forum

Live
✅ DM
✅ group
✅ forum
✅ long streaming
✅ question
✅ media
✅ errors

Security
✅ wrong sender
✅ wrong thread
✅ stale callback
✅ Access Gate
```

才可以认为：

> Telegram 是“基本完整的 Harness Agent Channel”。

---

# 19. 是否调整总体架构

最终答案：

```text
不调整主架构。
```

只做局部演进。

---

## 保持

```text
Stable Channel Core
Thin Harness Bridge
Independent Adapters
Upstream Driver
Control Plane
Compatibility Governance
```

---

## 新增/强化

```text
Directional media capability
Attachment Provider compatibility seam
ReplyPrompt
BinaryPresentation
CommandHint
Telegram update trust boundary
Live Gate
```

---

## 禁止

```text
Adapter 调 ctx.agents
Core if telegram
Harness import Telegram SDK
Attachment layer 自动做内容理解
第二套 UserQuestionProvider 抢 Web
raw Telegram payload 作为模型输入
```

---

# 20. 对最新 Attachment Gateway 的最终意见

`f085a55` 的核心设计建议保留。

尤其正确的是：

```text
transport hydration
≠
consumer capability
```

也就是说：

```text
即使当前模型不会直接理解 video，
Telegram 也应该把 video 可靠下载成 bytes。
```

因为未来：

```text
Skill
MCP
Harness native generic attachment
video plugin
```

都可能消费。

不要让：

```text
“现在 Agent 用不到”
```

成为 adapter 不下载的理由。

---

# 21. 旧附件兼容策略

继续：

```text
attachments/v1 永久可读
```

新：

```text
catalog/v2
```

迁移：

```text
lazy copy + verify
```

原则：

```text
不 startup 全量迁移
不 inplace rewrite
不删除旧 bytes
migration fail
→ legacy authoritative
```

这是合适的用户数据兼容策略。

---

# 22. Harness 未来 generic attachment 出现后的替换策略

不要：

```text
if Harness version >= x
```

建议：

```text
public capability detection
```

例如未来官方真正提供：

```text
ctx.attachments.saveFile
generic attachment types
```

才：

```text
native backend enabled
```

路径：

```text
new attachment
→ native

old attachment
→ lazy migrate/copy/verify
→ native if success
→ legacy fallback if fail
```

`channel-files` 不必立即删除，可以长期：

```text
legacy reader
compatibility backend
migration backend
```

---

# 23. 最终推荐开发顺序

如果明天开始执行：

```text
Day/Batch 1
P0 message identity
P0 media truth
P0 Zod
P0 callback thread
docs sync

Day/Batch 2
ForceReply
Question correlation
Question terminal regressions

Day/Batch 3
Typing
Command Menu

Day/Batch 4
Voice
Sticker
Animation
Video Note
Location/Contact
Outbound MediaGroup

Day/Batch 5
Inbound Album Aggregation
Reaction

Day/Batch 6
Ephemeral

Final
Full TG × Harness Live Gate
0.5.x release verify
```

---

# 24. 执行时最重要的三条判断

### 第一条

```text
平台支持
≠
模型理解
```

### 第二条

```text
SessionBinding
= WHERE

ReplyContext
= SHOULD this turn reply
```

### 第三条

```text
Capability
= 已验证承诺
≠
愿望清单
```

只要执行过程中一直守住这三条，项目后续扩到第 10、第 30 个 Channel 也不会失控。

---

# 25. 核验依据

## dsh-channels

本次重点：

```text
HEAD f085a55

docs/architecture.md
package.json

packages/channel-core/src/capabilities.ts
packages/channel-core/src/messages.ts
packages/channel-core/src/adapter.ts
packages/channel-core/src/events.ts
packages/channel-core/src/media/*

packages/channel-harness/src/bridge.ts
packages/channel-harness/src/reply-router.ts
packages/channel-harness/src/file-provider.ts
packages/channel-harness/src/interactions/*
packages/channel-harness/src/message-converter.ts

packages/channel-telegram/README.md
packages/channel-telegram/src/adapter.ts
packages/channel-telegram/src/mapper.ts
packages/channel-telegram/src/inbound.ts
packages/channel-telegram/src/media-hydrator.ts
packages/channel-telegram/src/outbound.ts
packages/channel-telegram/src/upstream.ts
packages/channel-telegram/src/render/*
packages/channel-telegram/test/*
```

## DeepSeek Harness

```text
tag dsh-v0.1.1-rc.2

packages/interaction/user-questions
packages/host/apiproxy
packages/attachment/attachment
```

## Telegram

```text
Bot API 10.2
```

---

# 26. 验证声明

本方案基于：

```text
GitHub 当前 main 源码静态核验
+
官方 Harness rc.2 source contract 核验
+
现有 tests/docs 结构核验
```

本次 GitHub combined commit status 没有暴露可确认的 status entries。

因此本文不声称：

```text
已经替你重新运行本地 pnpm ci:check
已经完成真实 Telegram Bot Live Gate
```

最终生产成熟度必须由本文：

```text
自动 Gate
+
真实 TG × Harness Live Gate
```

共同确认。

---

# 27. 一句话最终方案

> 保持现有 Harness-native Channel 架构和最新 Attachment Gateway；先修 Telegram 的 message identity / thread identity / Zod / media truth / multi-media no-drop，再补 ForceReply、typing、command menu、album、voice/sticker/GIF/video-note/location/contact/reaction，最后做 TG×Harness DM/Group/Forum/Web-origin 全链路 Live Gate。完成后 Telegram 可视为 Harness Agent 日常使用基本完整，不再追求 Bot API 全量覆盖。
