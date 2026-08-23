---
title: dsh-channels 通用附件传递、会话隔离与 Harness Native 迁移执行方案
summary: 将 dsh-channels 的文件能力收敛为跨渠道 Attachment Gateway：Channel 只负责识别、下载、校验、持久化、会话 ACL 与可靠传递；内容理解交由 DeepSeek Harness / Skill / Agent 能力；兼容现有 channel-files v1 数据并为未来 Harness Generic Attachment 原生能力预留无损迁移路径。
when_to_use: attachment | file | audio | video | session isolation | channel-files | harness native | migration | compatibility
authoritative: 本方案定义附件职责边界、跨渠道 hydration、Session ACL、旧数据兼容、Native-first/Fallback、惰性迁移与验收标准。
status: proposed
baseline:
  repository: https://github.com/wsz987/dsh-channels
  branch: main
  repository_version: 0.4.2
  harness_pinned: 0.1.1-rc.2
date: 2026-08-23
---

# dsh-channels 通用附件传递、会话隔离与 Harness Native 迁移执行方案

> **最终决策**
>
> `dsh-channels` 负责 **附件可靠传递与隔离**，不负责长期演进“附件理解能力”。
>
> - Channel Adapter：识别平台媒体、解析平台 locator、下载/解密为可信 bytes。
> - Channel Core：只保存跨渠道结构化 `MessagePart`，不落盘、不调用 Harness、不理解 PDF/音频/视频。
> - Channel Harness：绑定 Harness Session，并把附件提交到统一 Attachment Gateway。
> - `channel-files`：现阶段作为 **Generic Attachment compatibility backend + legacy reader** 保留。
> - DeepSeek Harness 原生图片继续走 `@deepseek-ai/dsh-attachment`。
> - PDF / DOCX / XLSX / TXT / Audio / Video 的“理解”未来优先交给 Harness Native、Skill、Agent Tool 或独立能力插件。
> - DeepSeek Provider Files API 不进入 Channel 层。
> - 所有 Generic Attachment 必须保持 **Session ACL**，不得用 workspace 路径权限代替。
> - 旧 `attachments/v1` 数据不强制迁移、不删除；新后端上线后采用 **Native-first + Legacy fallback + Lazy migration + Delayed GC**。

---

## 1. 核验结论

### 1.1 当前项目分层与本方案一致

当前仓库已经明确：

```text
Channel Core
  = Stable Channel Contract

channel-harness
  = 唯一 Harness Agent / Session API Boundary

Channel Adapter
  = Platform <-> Channel Contract

Upstream Driver
  = SDK / API / protocol isolation

channel-files
  = optional generic-file extension
```

现有架构红线要求：

```text
channel-core      不 import Harness Agent API
channel-adapter   不访问 ctx.agents
channel-harness   不 import 平台 SDK
channel-web       不访问 Harness Agent API
adapter           不直接读写 Harness persistence
raw platform      不直接进入模型
```

因此附件能力不能做成：

```text
Telegram -> Harness private API
Lark     -> Harness private API
QQ       -> DeepSeek Files API
```

必须继续走公共边界：

```text
Platform
  ↓
Adapter / Upstream
  ↓
Channel MessagePart
  ↓
channel-harness
  ↓
Attachment Gateway
  ↓
Harness Agent
```

本方案不改变这个依赖方向。

---

## 2. Harness 当前能力边界

### 2.1 Harness 已原生支持图片附件

当前项目已经正确使用：

```text
ImagePart.localData
  ↓
SaveImageHook
  ↓
@deepseek-ai/dsh-attachment
  ↓
ImageAttachmentRef
  ↓
ImageBlock
  ↓
LLM Adapter
```

DeepSeek Harness `0.1.1-rc.2` 的 DeepSeek Files API 路径属于 **图片 request transport**：

```text
Harness durable image
  ↓
route request version
  ↓
llm-deepseek
  ↓
DeepSeek Files API
  ↓
file_id
```

**它不是 Generic File Attachment API。**

因此禁止：

```text
channel-files
  ↓
直接调用 DeepSeek Files API
```

Provider 文件生命周期必须继续由 Harness LLM Adapter 管理。

### 2.2 Generic File 仍未成为 Harness 原生统一内容块

当前官方图片附件设计仍明确把：

```text
generic files
PDF
audio
video
```

视为独立后续能力。

因此当前不能删除：

```text
@wsz987/channel-files
```

否则 PDF / DOCX / XLSX / TXT 以及 Generic Audio / Video 的持久附件入口会退化为 placeholder。

### 2.3 workspace-write / full access 不能代替附件 ACL

Harness 当前文件沙箱主要限制 **写入效果**：

```text
workspace-write:
  write -> workspace / temp
  read  -> filesystem read path 不由该写入边界提供 Session ACL

danger-full-access:
  bypass confinement
```

所以：

```text
Agent 能 read(path)
```

不等于：

```text
Agent 被允许读取这个 Session 的附件
```

禁止把真实附件路径直接暴露给模型并依赖 workspace-write 做隔离。

---

# 3. 本次目标

## 3.1 Channel 层只负责“可靠传递”

统一职责：

```text
平台附件
   ↓
识别类型
   ↓
解析平台 locator
   ↓
下载 / 解密
   ↓
大小限制
   ↓
可信 bytes
   ↓
统一 MIME 验证
   ↓
持久化
   ↓
Session ACL
   ↓
稳定 attachment_id
   ↓
交给 Harness Agent
```

Channel 层不负责：

```text
PDF 语义理解
DOCX 结构理解
XLSX Agent 分析
Audio ASR
Video 抽帧
Video 内容理解
OCR
Embedding
RAG
```

这些属于：

```text
Harness Native
Skill
Agent Tool
MCP
Media Capability Plugin
Provider Native Multimodal
```

---

# 4. 当前代码已经具备的基础

## 4.1 Channel Core 已有统一 Binary Contract

现有 `MessagePart`：

```ts
type MessagePart =
  | TextPart
  | ImagePart
  | FilePart
  | AudioPart
  | VideoPart
  | LocationPart
  | CardPart
  | UnsupportedPart
```

二进制载体已有：

```text
url
resourceRef
dataUri
localData
```

语义已经正确：

- `url`：真实 http(s) locator。
- `resourceRef`：平台不透明句柄，例如 Telegram `file_id`、Lark `file_key`、DingTalk `downloadCode`。
- `localData`：Adapter / Upstream 已完成平台下载/解密后的可信 bytes。
- Core 不负责下载、不落盘。

**本次不新增平台特化字段。**

---

## 4.2 当前 Generic Attachment 已绑定 Session

现有 `StoredChannelAsset` 已包含：

```ts
{
  schemaVersion: 1,
  attachmentId,
  sessionId,
  channelId,
  accountId,
  conversationId,
  conversationType?,
  threadId?,
  messageId,
  kind,
  name,
  mimeType?,
  bytes,
  sha256,
  extraction,
  createdAt
}
```

当前已经满足最关键的 provenance：

```text
attachment
  ↳ session
  ↳ channel
  ↳ account
  ↳ conversation
  ↳ thread
  ↳ message
```

当前 `attachmentId` 使用：

```text
att-<UUID>
```

这是好设计。

它天然可以继续作为 **稳定逻辑 ID**，不要改成 Harness native id，也不要改成真实文件路径。

---

## 4.3 当前读取已经有正确 ACL

现有：

```text
read_channel_attachment
```

只接收：

```ts
{
  attachment_id,
  offset?,
  limit?
}
```

不接收：

```text
path
session_id
channel_id
conversation_id
```

执行时使用调用 Agent 的 Session：

```text
current agent/session id
       ↓
asset.sessionId
       ↓
equal      -> allow
different  -> ATTACHMENT_ACCESS_DENIED
```

这个原则必须保留到 Harness Native Generic Attachment 出现以后。

---

# 5. 当前真正需要修的跨渠道问题

本次最重要的工程修复不是“删 channel-files”，而是：

> **所有声明/实际能够接收入站二进制的渠道，都应该尽量完成 locator -> localData。不要因为当前 Agent 还不会理解 Audio/Video，就故意不下载。**

Channel 是 Transport Layer。

有没有 Consumer 不应该决定 Transport 是否把 payload 可靠送达。

---

## 5.1 当前渠道状态

### Weixin

当前 `main` 已具备：

```text
Inbound:
image -> download/decrypt -> localData
file  -> download/decrypt -> localData
audio -> download/decrypt -> Silk transcode -> localData
video -> download/decrypt -> localData

Outbound:
image
file
video

audio outbound:
暂不支持
```

Weixin 已经最接近本方案目标。

但出现一个能力模型问题：

```ts
capabilities.audio = false
```

同时 inbound mapper 和 upstream 实际可以：

```text
voice -> AudioPart -> localData
```

说明当前顶层 `audio: boolean` 同时表达 inbound/outbound 已经不够精确。

---

### QQ

当前 mapper 已能产生：

```text
image -> url
file  -> url
audio -> voice_wav_url / url
video -> url
```

但 hydrator 当前只处理：

```text
image
file
```

因此：

```text
audio
video
```

虽然结构化识别成功，却没有进入 Generic Attachment store。

**本次应补齐。**

---

### Telegram

当前 mapper 能产生：

```text
image -> resourceRef(file_id)
file  -> resourceRef(file_id)
audio -> resourceRef(file_id)
video -> resourceRef(file_id)
```

`getFile + /file/bot...` upstream 已经是通用下载能力。

但当前 `hydrateTelegramParts()` 明确只处理：

```text
image
file
```

audio/video 仍保留 `resourceRef` placeholder。

**本次应改为所有支持的 binary part 共用同一个 downloadFile(file_id)。**

---

### Lark / Feishu

当前 mapper 已区分：

```text
image -> image_key / URL
file  -> file_key / URL
audio -> file_key / URL
video -> file_key / URL
```

当前 `ImageHydrator` 实际只 hydrate：

```text
image
file
```

**本次至少应把 audio 纳入 Generic Attachment ingress。**

video 是否可通过当前 `messageResource.get` + `LarkMediaPort` 下载，要用官方 SDK fixture + live gate 验证；如果可以，统一纳入；如果平台/当前 Port 不支持，保留 `resourceRef + ingressFailure/resource-unavailable`，不得伪造 bytes。

---

### DingTalk

当前 mapper 已产生：

```text
image
file
audio
video
```

locator 可以是：

```text
real http(s) URL
downloadCode
media id / resourceRef
```

当前 hydration 主路径只完成：

```text
image
file
```

**本次应验证官方 `messageFiles/download` 是否覆盖 audio/video。**

如果覆盖：

```text
audio/video -> localData
```

如果不覆盖：

```text
保留 resourceRef
+ 明确 ingressFailure
```

不得把“adapter capabilities.audio=true”误当成“已经有可消费 raw bytes”。

---

# 6. P0：统一 Binary Hydration 规则

## 6.1 新的原则

Adapter/Upstream 对每个 BinaryPart 应遵循：

```text
已有 localData/dataUri
  ↓
不重复下载

真实 http(s) URL
  ↓
SecureRemoteMediaFetcher
  ↓
bounded bytes

resourceRef
  ↓
平台 Upstream Resolver
  ↓
bounded bytes

成功
  ↓
localData
verified/normalized mime hint
size
clear ingressFailure

失败
  ↓
保留 locator
设置 stable ingressFailure
文本消息继续投递
```

---

## 6.2 不要在 Core 写统一“远程下载所有平台资源”

错误：

```ts
// channel-core
if (part.resourceRef) download(...)
```

原因：

```text
Telegram file_id
Lark file_key
DingTalk downloadCode
Weixin encrypted CDN ref
```

都需要平台 credential / protocol context。

正确：

```text
Adapter
  ↓
Upstream Resolver
  ↓
localData

Channel Core
  ↓
只接收结果
```

---

## 6.3 建议抽公共 hydration helper，但只抽协议无关部分

可在 `channel-core` 或独立公共模块提供纯工具：

```ts
type HydratableBinaryPart =
  | ImagePart
  | FilePart
  | AudioPart
  | VideoPart

interface BinaryHydrationResult {
  data: Uint8Array
  mimeType?: string
  name?: string
}

async function applyHydrationResult(
  part: HydratableBinaryPart,
  resolve: () => Promise<BinaryHydrationResult>,
  policy: BinaryHydrationPolicy,
): Promise<void>
```

它只负责：

```text
size cap
AbortSignal
localData assignment
name/mime/size merge
stable ingressFailure mapping
```

**不负责解析 resourceRef。**

平台 Resolver 仍分别存在：

```text
TelegramFileResolver
LarkMediaPort
DingTalk MediaResolver
WeixinUpstream
QQ SecureRemoteMediaFetcher
```

---

# 7. P1：修正 ChannelCapabilities 的方向歧义

当前：

```ts
interface ChannelCapabilities {
  image: boolean
  file: boolean
  audio: boolean
  video: boolean
}
```

无法表达：

```text
Weixin:
audio inbound = yes
audio outbound = no
```

也无法表达：

```text
DingTalk:
video mapper = yes
video raw-byte ingress = 待验证
video outbound = no
```

## 7.1 兼容扩展，不直接删除旧字段

推荐：

```ts
type BinaryKind = 'image' | 'file' | 'audio' | 'video'

type InboundBinaryCapability =
  | 'bytes'       // 能稳定提供 localData
  | 'locator'     // 能映射 locator，但不保证立即拿到 bytes
  | 'unsupported'

type OutboundBinaryCapability =
  | 'bytes'
  | 'unsupported'

interface ChannelMediaCapabilities {
  inbound: Partial<Record<BinaryKind, InboundBinaryCapability>>
  outbound: Partial<Record<BinaryKind, OutboundBinaryCapability>>
}

interface ChannelCapabilities {
  // legacy/coarse fields：保留至少一个兼容周期
  image: boolean
  file: boolean
  audio: boolean
  video: boolean

  media?: ChannelMediaCapabilities

  // existing fields...
}
```

原则：

```text
旧 consumer:
继续读 image/file/audio/video

新 Attachment Gateway / Verify:
优先读 capabilities.media
```

---

## 7.2 建议目标矩阵

```text
Weixin
  inbound:  image=bytes file=bytes audio=bytes video=bytes
  outbound: image=bytes file=bytes audio=unsupported video=bytes

QQ
  inbound:  image=bytes file=bytes audio=bytes video=bytes
  outbound: 按官方 SDK 当前真实实现声明

Telegram
  inbound:  image=bytes file=bytes audio=bytes video=bytes
  outbound: image=bytes file=bytes audio=bytes video=bytes

Lark
  inbound:  image=bytes file=bytes audio=bytes
            video=bytes 或 locator（以官方 media API 实测为准）
  outbound: 按当前 OutboundSender 真实支持声明

DingTalk
  inbound:  image=bytes file=bytes
            audio/video 以 messageFiles/download live gate 后决定
  outbound: 按当前 OpenAPI 实现真实声明
```

`channel-verify` 应检查：

```text
capabilities.media.inbound[kind] === 'bytes'
```

时，对应 adapter fixture 必须证明 emit 前存在：

```ts
part.localData.byteLength > 0
```

---

# 8. Attachment Gateway：目标架构

```text
                         Channel Adapter
                               │
                    locator -> trusted bytes
                               │
                               ▼
                          MessagePart
                               │
                               ▼
                        channel-harness
                               │
                  ┌────────────┴────────────┐
                  │                         │
            Native Image              Generic Attachment
        @deepseek-ai/dsh-attachment           │
                  │                           ▼
                  │                    Attachment Gateway
                  │                           │
                  │             ┌─────────────┴─────────────┐
                  │             │                           │
                  │      Harness Native Backend       Legacy V1 Backend
                  │       future generic API          channel-files
                  │             │                           │
                  └─────────────┴─────────────┬─────────────┘
                                              │
                                         Session ACL
                                              │
                                              ▼
                                         Harness Agent
                                              │
                           ┌──────────────────┼──────────────────┐
                           │                  │                  │
                       Native Tool           Skill          Capability
                           │                  │                  │
                          PDF               ASR              Video/OCR
```

---

# 9. `channel-files` 的新定位

当前名称可以保留，避免包级 breaking change。

README/架构定位改为：

> **Generic attachment compatibility backend for DeepSeek Harness Channels.**
>
> Stores session-scoped non-image attachments and preserves legacy readable
> extraction while Harness does not yet provide a native generic attachment
> contract.

不要再把它定义成：

> Channel 自己负责文档理解。

---

## 9.1 现有 extractor 如何处理

当前：

```text
PDF  -> unpdf
DOCX -> mammoth
XLSX -> xlsx
text -> text
```

**本次不要删除。**

原因：

1. 老用户已经依赖 `read_channel_attachment`。
2. 删除会让已有 PDF/DOCX/XLSX 能力直接回退。
3. 未来 Harness Native Generic File API 还没到位。
4. 旧资产已有 `extracted.md`，必须继续可读。

但要修改定位：

```text
legacy compatibility extraction
```

而不是继续扩张成：

```text
PPTX parser
audio ASR
video analyzer
OCR engine
```

规则：

> **不再向 channel-files 新增“理解类”能力。**

新增理解能力放：

```text
Harness
Skill
独立 plugin
MCP
```

---

# 10. Provider 接口演进

当前：

```ts
interface ChannelFileProvider {
  store(...)
  installTools(...)
  resolveAttachment(...)
}
```

这个边界总体正确。

建议做一次兼容重命名：

```ts
export interface ChannelAttachmentProvider {
  store(
    context: ChannelAttachmentContext,
    part: StoredBinaryPart,
  ): Promise<ChannelAttachmentDescriptor | undefined>

  resolveAttachment(
    attachmentId: string,
    sessionId: string,
  ): Promise<ResolvedChannelAttachment>

  installCompatibilityTools?(
    agentContext: Context,
  ): Promise<void>
}

/**
 * @deprecated use ChannelAttachmentProvider
 */
export type ChannelFileProvider = ChannelAttachmentProvider
```

不要立即删除旧 export。

---

## 10.1 为什么 `installTools()` 应降级为 compatibility

未来 Harness 可能自带：

```text
read attachment
generic file block
audio/video input
skill file resolver
```

因此 Provider 的核心职责应该是：

```text
store
resolve
ACL
```

而不是：

```text
必须安装某个模型 Tool
```

所以新接口中：

```text
installCompatibilityTools?
```

应该是 optional。

当前 `read_channel_attachment` 继续注册。

等 Harness Native 具备完整替代能力后再 deprecated。

---

# 11. Stable Logical Attachment ID

必须坚持：

```text
Channel Attachment ID
!= path
!= Harness AttachmentId
!= provider file_id
```

推荐：

```text
att-<UUID>
```

永久作为 Channel logical id。

未来：

```ts
interface AttachmentLocator {
  backend: 'channel-v1' | 'harness-native'
  nativeId?: string
}
```

例如：

```json
{
  "attachmentId": "att-8d6d...",
  "backend": "harness-native",
  "nativeId": "sha256:abc..."
}
```

历史消息、Agent descriptor、outbox 永远继续引用：

```text
att-8d6d...
```

---

# 12. 新增 Attachment Catalog，而不是改写旧 v1 数据

当前 `attachments/v1` 已在生产路径中使用。

不要直接把旧 `meta.json` 原地升级。

建议新增：

```text
attachments/
  v1/
    sessions/...              # 完全保持旧结构

  catalog/
    v2/
      by-id/
        <attachmentId>.json
```

Catalog v2：

```ts
interface AttachmentCatalogRecordV2 {
  schemaVersion: 2

  attachmentId: string

  owner: {
    sessionId: string
  }

  provenance: {
    channelId: string
    accountId: string
    conversationId: string
    conversationType?: 'dm' | 'group'
    threadId?: string
    messageId: string
  }

  file: {
    kind: 'file' | 'audio' | 'video'
    name: string
    mimeType?: string
    bytes: number
    sha256: string
  }

  storage:
    | {
        backend: 'channel-v1'
      }
    | {
        backend: 'harness-native'
        nativeId: string
      }

  migration?: {
    sourceBackend?: 'channel-v1'
    migratedAt?: number
    verifiedAt?: number
    legacyRetained?: boolean
  }

  createdAt: number
}
```

---

## 12.1 为什么不强制迁移 v1

升级时禁止：

```text
boot
 ↓
scan all old attachments
 ↓
rewrite
 ↓
delete v1
```

问题：

```text
启动时间不可控
磁盘翻倍
中途 crash
Native Harness bug
几十 GB 历史附件
回滚困难
```

正确：

```text
旧数据不动
新 writer 写最新格式
旧 reader 永远兼容
```

---

# 13. 读取策略：Native-first + Legacy fallback

统一 Resolver：

```text
resolve(attachmentId, sessionId)
        │
        ▼
Catalog v2 exists?
        │
   ┌────┴────┐
  yes        no
   │          │
backend       ▼
   │      Legacy V1 lookup
   │          │
   │          ├─ found -> verify session ACL -> return
   │          │            └─ optional catalog backfill
   │          │
   │          └─ missing -> ATTACHMENT_NOT_FOUND
   │
   ├─ harness-native
   │      ↓
   │   native backend resolve
   │
   └─ channel-v1
          ↓
       legacy store
```

ACL 始终在 logical resolver 上先执行：

```text
record.owner.sessionId === currentSessionId
```

不能因为 backend 是 Harness Native 就跳过 Channel Session ACL。

---

# 14. 写入策略：Capability Detect，不做版本字符串猜测

未来 Harness 加 Generic Attachment 后，不建议：

```ts
if (harnessVersion >= '0.2.0') ...
```

推荐 capability detection：

```ts
const native = ctx.get('attachments') // illustrative only
const generic = hasGenericFileCapability(native)
```

只有明确存在 **官方 public generic attachment API** 才切 native。

不要把当前 image-only `ctx.attachments` 误判成 generic file support。

伪代码：

```ts
async function storeAttachment(context, part) {
  if (nativeGenericAttachments?.supports(part.type, part.mimeType)) {
    return storeNative(context, part)
  }

  return storeLegacyV1(context, part)
}
```

---

# 15. Lazy Migration

未来 Native Generic Attachment 可用后：

```text
read old att-xxx
      ↓
legacy v1 read
      ↓
verify old sha256
      ↓
copy to Harness native
      ↓
read-back / verify native metadata
      ↓
verify sha256 + bytes
      ↓
write Catalog v2 -> harness-native
      ↓
legacyRetained = true
```

重要：

> **迁移成功后也不要立即删除旧 bytes。**

---

## 15.1 Migration 必须是 copy + verify，不是 move

禁止：

```text
rename old -> new
delete old
```

正确：

```text
copy
 ↓
verify
 ↓
switch locator
 ↓
retain old
```

---

## 15.2 失败规则

任何一步失败：

```text
Native upload fail
Native write fail
Hash mismatch
Catalog write fail
Process crash
```

结果：

```text
继续以 legacy v1 为 authoritative
```

用户仍可读取旧文件。

---

# 16. Delayed GC

GC 必须是独立功能，不属于 migration transaction。

默认：

```text
不自动删除 legacy data
```

未来可以增加：

```text
channels attachments gc
```

或管理 API。

只有满足：

```text
catalog backend = harness-native
migration verified
legacyRetained = true
native object still readable
retention period passed
not dry-run
```

才能删除 legacy bytes。

建议：

```text
默认 dry-run
显式 --apply
```

---

# 17. Session 隔离规则

## 17.1 ACL 的唯一 owner 是 Harness Session

访问判定：

```text
attachment.owner.sessionId
==
invoking Agent session id
```

额外字段：

```text
channelId
accountId
conversationId
threadId
messageId
```

用于 provenance / debug / migration。

**不能代替 session ACL。**

---

## 17.2 `/new` 的语义

当前 Channel Session key：

```text
channel:account:conversation[:thread]
```

`/new` 会创建新 Harness Session。

因此：

```text
旧 Session attachment
      ↓
仍然保留在磁盘
      ↓
新 Session 默认无权直接读取
```

这是正确行为。

不要为了“旧文件还能找到”而自动把所有历史附件授权给新 Session。

否则：

```text
Session isolation
```

会被破坏。

如果未来产品需要跨 Session 复用附件，必须增加显式能力：

```text
grant/copy attachment
```

而不是弱化 ACL。

---

## 17.3 Session resume

同一 `sessionId` resume：

```text
附件权限保持不变
```

当前 ephemeral recreate 如果保留 recorded session id：

```text
附件仍可读取
```

这正是 attachment ACL 绑定 Session ID 的价值。

---

## 17.4 stale binding / session missing

如果 persisted Session 真正丢失：

```text
普通消息
  -> fail loud

/new
  -> 用户显式建立新 Session
```

附件：

```text
旧 bytes 不删除
旧 metadata 不删除
旧 attachmentId 不失效
但不自动授权到新 Session
```

这样同时满足：

```text
不丢数据
+
不越权
```

---

# 18. Skill / Future Capability 如何使用附件

Channel 不需要提前理解内容。

Agent 收到 descriptor：

```text
[attachment att-xxx meeting.mp4 video/mp4 80MB]
```

然后未来：

```text
用户：总结视频
        ↓
Agent
        ↓
Video Skill / Tool
        ↓
Attachment Resolver
        ↓
session ACL
        ↓
raw bytes
        ↓
video model / ffmpeg / ASR / vision
```

---

## 18.1 不建议把 raw bytes 塞进模型 prompt

禁止：

```text
base64 80MB video
  ↓
prompt
```

Resolver 应为 Host capability 提供受控 bytes stream / bounded read。

---

## 18.2 如果 Skill 必须调用本地 CLI

未来可以新增 **Session-scoped materialization lease**，但不要把附件永久复制到 workspace。

接口示意：

```ts
await attachments.withMaterializedFile(
  {
    attachmentId,
    sessionId,
  },
  async ({ path }) => {
    // ffmpeg / whisper / document tool
  },
)
```

要求：

```text
path 位于私有 session temp
随机目录
owner-only
生命周期结束自动删除
不写项目 workspace
不返回给其他 Session
```

这属于 Future Capability，不是本次 P0 必须实现。

---

# 19. Agent-facing Tool 策略

## 当前

继续保留：

```text
read_channel_attachment
```

用于：

```text
TXT
PDF legacy extraction
DOCX legacy extraction
XLSX legacy extraction
```

Audio / Video：

```text
read_channel_attachment
```

可以返回 descriptor：

```text
readable: false
```

不要尝试自动 ASR/Video Analyze。

---

## Future

当 Harness Native 提供统一能力：

```text
阶段 1
read_channel_attachment -> legacy only

阶段 2
read_channel_attachment -> unified resolver
                          -> legacy/native

阶段 3
Harness native tool 成为主路径
read_channel_attachment -> compatibility alias

阶段 4
超过支持窗口后才考虑删除 alias
```

---

# 20. 不要把 Attachment Store 搬进 Workspace

现有 private store 方向正确：

```text
channel data/
  attachments/
```

而不是：

```text
project/
  .attachments/
```

原因：

```text
附件 != 项目文件
附件不应污染 git status
附件生命周期 != workspace 生命周期
附件 ACL 是 session，不是 workspace
```

用户明确要求把文件复制进项目时，才由 Agent 在授权规则下显式写 workspace。

---

# 21. 文件/MIME 安全边界

继续坚持现有设计：

```text
platform mime
HTTP Content-Type
filename extension
```

都只能是：

```text
hint
```

真正持久化前：

```text
magic-signature verify
```

必须保留：

```text
max inbound bytes
parser input cap
extracted output cap
raw read cap
filename sanitize
hash
atomic write
```

对于 audio/video 新增 hydration 后，也必须走相同 raw size cap。

---

# 22. 日志与隐私

允许日志：

```text
channel
accountId
conversationId
sessionId
messageId
kind
sanitized name
mimeType
bytes
attachmentId
ingressFailure
backend
migration result
```

禁止：

```text
raw bytes
base64
token
signed URL
Telegram bot token path
Lark file_key if considered sensitive
DingTalk downloadCode
Weixin AES key
sessionWebhook
```

平台 locator 在 hydration 完成后不进入 durable Generic Attachment metadata。

这与现有 `StoredChannelAsset` “不持久化 transient platform state”的方向一致。

---

# 23. 具体代码修改计划

## Phase A — P0：统一 Transport 语义

### A1. `channel-core`

文件：

```text
packages/channel-core/src/*
```

任务：

1. 保持现有 `MessagePart` union。
2. 增加公共 binary hydration result/error helper（只做协议无关逻辑）。
3. 不增加平台字段。
4. 保留 `resourceRef/url/dataUri/localData`。
5. 可加入 `BinaryKind` 公共类型。

DoD：

```text
Core 无 fetch platform API
Core 无 Harness dependency
Core 无 file persistence
```

---

### A2. Telegram

文件：

```text
packages/channel-telegram/src/media-hydrator.ts
packages/channel-telegram/src/inbound.ts
packages/channel-telegram/test/*
fixtures/telegram/*
```

修改：

当前：

```ts
if (part.type !== 'image' && part.type !== 'file') return
```

调整为：

```text
image
file
audio
video
```

全部使用现有：

```text
TelegramFileResolver.downloadFile(fileId)
```

成功后：

```text
localData
mimeType
name where applicable
size where applicable
```

验收：

```text
voice -> AudioPart.localData
audio -> AudioPart.localData
video -> VideoPart.localData
document -> FilePart.localData
photo -> ImagePart.localData
```

---

### A3. QQ

文件：

```text
packages/channel-qq/src/image-hydrator.ts
packages/channel-qq/src/inbound.ts
packages/channel-qq/test/*
fixtures/qq/*
```

建议顺便重命名：

```text
image-hydrator.ts
→ media-hydrator.ts
```

如果担心 import breaking：

```text
旧文件 re-export 新实现一个版本
```

hydration types：

```text
image
file
audio
video
```

QQ mapper 已经提供：

```text
voice_wav_url
audio url
video url
```

直接使用 SecureRemoteMediaFetcher。

---

### A4. Lark

文件：

```text
packages/channel-lark/src/media-hydrator.ts
packages/channel-lark/src/upstream/media-port.ts
packages/channel-lark/test/*
fixtures/lark/*
```

修改：

1. `ImageHydrator` 改名/抽象成 `MediaHydrator`。
2. image/file 保持现有行为。
3. audio 使用 `messageResource.get` file resource path。
4. video 先按官方 SDK + fixture 验证：
   - 可以下载 -> `localData`
   - 不可以 -> 保持 locator 并显式 failure。

不要编造 platform API。

---

### A5. DingTalk

文件：

```text
packages/channel-dingtalk/src/inbound.ts
packages/channel-dingtalk/src/image-hydrator.ts
packages/channel-dingtalk/src/openapi-port.ts
packages/channel-dingtalk/test/*
fixtures/dingtalk/*
```

修改：

1. 统一 helper 命名为 media hydration。
2. 验证 `messageFiles/download` 对 audio/video 的实际支持。
3. 支持则落 `localData`。
4. 不支持则 `resourceRef + stable ingressFailure`。

---

### A6. Weixin

Weixin 当前入站：

```text
image/file/audio/video
```

已经统一 hydrate。

本阶段主要：

1. 加回归测试。
2. 把 current behavior 纳入跨渠道 contract fixture。
3. 不把 `transcodeSilkVoice` 搬到 `channel-files`。
   - Silk 是 Weixin upstream wire-format normalization。
   - 属于平台 transport boundary。
4. 保持 decrypted/transcoded bytes 才进入 Channel Contract。

---

# 24. Phase B — P0：Attachment Gateway 兼容重构

## B1. `channel-harness`

文件：

```text
packages/channel-harness/src/file-provider.ts
packages/channel-harness/src/message-converter.ts
packages/channel-harness/src/bridge.ts
packages/channel-harness/src/index.ts
packages/channel-harness/test/*
```

新增/调整：

```text
ChannelAttachmentProvider
ChannelAttachmentContext
ChannelAttachmentDescriptor
```

兼容 export：

```text
ChannelFileProvider -> deprecated alias
ChannelFileContext  -> deprecated alias
```

Bridge 仍负责：

```text
binding.sessionId
+ event identity
→ store()
```

Adapter 不知道 SessionId。

---

## B2. 不把 Generic Attachment store 移入 Core

继续：

```text
channel-core
   ↓
MessagePart only

channel-harness
   ↓
session aware attachment port

channel-files
   ↓
implementation
```

这是与当前项目红线最一致的落点。

---

# 25. Phase C — P0：Legacy Compatibility

## C1. v1 永久 reader

现有：

```text
attachments/v1
```

reader 不删除。

测试必须覆盖：

```text
旧 meta.json
旧 raw.bin
旧 extracted.md
```

在新版 package 下仍能：

```text
read_channel_attachment
resolveAttachment
outbox resend
```

---

## C2. Schema evolution

规则：

```text
Reader:
v1
v2
future vN

Writer:
只写当前最新格式
```

禁止：

```text
启动时原地 rewrite 所有 v1 meta
```

---

# 26. Phase D — P1：Attachment Catalog v2

建议新增：

```text
packages/channel-files/src/catalog/
  types.ts
  store.ts
  legacy-backfill.ts
```

职责：

```text
logical attachment id
    ↓
owner
provenance
hash
backend locator
migration state
```

Atomic write。

Catalog 丢失不能导致 v1 数据不可读：

```text
catalog miss
  ↓
legacy fallback
```

---

# 27. Phase E — P1：Native Harness Generic Attachment Adapter

**只有 Harness 官方 Generic Attachment public API 出现后实施。**

建议新增：

```text
packages/channel-harness/src/attachments/native-capability.ts
packages/channel-files/src/backends/harness-native.ts
```

或者未来将 native backend 独立 package：

```text
@wsz987/channel-attachments-harness
```

但当前没有必要提前拆包。

检测：

```text
public API capability detection
```

禁止：

```text
Harness version string guessing
private source import
provider Files API
```

---

# 28. Phase F — P1：Lazy migration + rollback

新增：

```text
packages/channel-files/src/migration/
  migrate-on-read.ts
  verify.ts
```

规则：

```text
legacy read successful
+ native available
+ migration enabled
  ↓
copy
verify
catalog switch
retain legacy
```

默认可配置：

```ts
migration: {
  nativeOnRead: false
}
```

初始发布建议：

```text
默认 false
```

先收集兼容数据。

下一小版本再考虑：

```text
默认 true
```

---

# 29. Phase G — P2：GC

新增 CLI/command 后再做：

```text
channels attachments status
channels attachments migrate
channels attachments gc --dry-run
channels attachments gc --apply
```

不是 P0。

---

# 30. Channel Bundle 行为

当前 bundle 默认包含：

```yaml
- id: channels-files
  name: '@wsz987/dsh-channels/files'
```

保留。

注释修改成：

```text
Generic attachment compatibility backend.
Required for non-image channel attachments until Harness provides native
generic attachment support. Legacy v1 data remains readable even after a
native backend becomes available.
```

未来 native backend 稳定后：

```text
channels-files
```

仍可继续加载作为：

```text
legacy reader
migration backend
compatibility tool
```

不能因为 native available 就从 bundle 自动移除，否则旧附件无人读取。

---

# 31. Failure Semantics

## Ingress download fail

```text
文本继续投递
binary part 保留
ingressFailure
不创建假 attachment
```

## Store fail

```text
普通消息继续
descriptor fallback
明确 warn log
```

保持现有 best-effort 语义。

## Session ACL fail

```text
fail closed
ATTACHMENT_ACCESS_DENIED
```

不能 best-effort。

## Hash integrity fail

```text
fail loud
不返回 bytes
```

## Native migration fail

```text
legacy 继续 authoritative
```

---

# 32. 多渠道 Contract Test

建议在 `channel-testkit` 增加：

```ts
runBinaryIngressContract({
  adapter,
  cases: [
    {
      kind: 'audio',
      expected: 'bytes'
    }
  ]
})
```

通用断言：

### `bytes`

```text
part.type correct
localData exists
localData > 0
no raw platform credential
no transient locator persisted into stored asset
```

### `locator`

```text
part.type correct
resourceRef/url exists
no fake localData
failure/status explicit
```

### Failure

```text
text still emitted
part retained
ingressFailure stable
```

---

# 33. Session ACL Test Matrix

至少覆盖：

```text
Session A stores att-1
Session A reads att-1 -> success

Session B reads att-1 -> ATTACHMENT_ACCESS_DENIED

same conversation /new -> Session B
Session B reads old att-1 -> ACCESS_DENIED

Session A resume
Session A reads att-1 -> success

legacy v1 file
same Session -> success

legacy v1 file
different Session -> denied
```

---

# 34. Migration Test Matrix

```text
v1 no catalog
 -> legacy read works

v1 no catalog + catalog backfill
 -> read works
 -> logical id unchanged

v1 -> native copy success
 -> hash equal
 -> catalog backend native
 -> legacy still exists

native copy fail
 -> catalog stays legacy
 -> legacy readable

native verify mismatch
 -> migration rejected
 -> legacy readable

catalog write crash/fail
 -> legacy readable

native backend unavailable after migration
 -> if legacy retained, controlled fallback allowed
 -> no data loss

GC dry-run
 -> no deletion

GC apply before retention
 -> no deletion
```

---

# 35. Harness Compatibility Matrix

CI 保持：

```text
Harness pinned-current
Harness latest-compatible
```

附件再增加：

```text
Harness image-native path
Harness generic-native absent
Harness future generic-native present (fake capability)
```

必须证明：

```text
generic API absent
 -> channel-files fallback

generic API present
 -> native writer

old v1
 -> regardless of native present, remains readable
```

---

# 36. Live Verification Matrix

## Telegram

真实 Bot：

1. 发送图片。
2. 发送 PDF。
3. 发送 voice note。
4. 发送 MP3。
5. 发送 MP4。
6. Harness debug 验证：
   - image -> native image attachment
   - PDF -> generic attachment
   - voice/audio -> generic attachment
   - video -> generic attachment
7. Agent 不要求理解内容，只验证 attachment descriptor/bytes 成功。

---

## QQ

真实 C2C / group：

```text
image
file
voice/audio
video
```

验证 CDN URL：

```text
secure fetch
size cap
mime hint
localData
```

---

## Lark

真实：

```text
image_key
file_key
audio file_key
video resource
```

验证官方 `messageResource.get` 的资源类型边界。

---

## DingTalk

真实 robot message：

```text
picture
file
audio
video
```

逐项核验：

```text
downloadCode
messageFiles/download
```

不能只靠 fixture 宣称支持。

---

## Weixin

真实 iLink：

```text
image
file
voice
video
```

验证：

```text
CDN download
AES decrypt
Silk transcode
localData
```

---

# 37. 用户可见行为

用户发送：

```text
meeting.mp4
```

Channel 不应该回复：

```text
我看懂了视频……
```

Channel/Harness message 只需让 Agent获得：

```text
[attachment att-xxx meeting.mp4 video/mp4 82MB]
```

之后由 Agent 根据用户需求决定是否调用 Skill/Tool。

用户只说：

```text
先保存这个
```

不触发昂贵视频分析。

用户说：

```text
总结这个视频
```

才由 Agent 选择未来 video capability。

---

# 38. Compatibility Policy

建议正式写进项目：

## 数据兼容

```text
旧格式可读：至少跨 2 个 minor release，最好直到明确 major breaking release。
```

对于附件数据更建议：

```text
长期 reader compatibility
```

因为数据不像 API import，可以重新安装解决。

## API 兼容

保留：

```text
ChannelFileProvider
read_channel_attachment
channel-files package name
attachments/v1 reader
```

至少一个明确 deprecation 周期。

---

# 39. 不应该做的方案

## 不做 1：删除 `channel-files`

当前 Harness Generic Attachment 尚未覆盖。

会直接造成回退。

## 不做 2：Channel 直接调用 DeepSeek Files API

破坏：

```text
Channel / Provider separation
```

也会把所有渠道绑到 DeepSeek Provider。

## 不做 3：把附件放 workspace

破坏：

```text
Session ACL
project cleanliness
attachment lifecycle
```

## 不做 4：让模型拿真实 private path

Harness filesystem read 权限不能替代 Session ACL。

## 不做 5：自动理解所有附件

会把 channel project 变成 media/document agent runtime。

## 不做 6：升级时强制搬迁所有旧文件

数据风险高且无必要。

## 不做 7：迁移完成立即删除 legacy bytes

回滚能力丢失。

---

# 40. 推荐实施顺序

## P0-1 — Binary ingress 完整化

```text
Telegram audio/video hydration
QQ audio/video hydration
Lark audio hydration + video capability verification
DingTalk audio/video capability verification/hydration
Weixin regression
```

目标：

> **Channel 支持某个入站 BinaryPart 时，尽可能把真实 bytes 交给 Attachment Gateway。**

---

## P0-2 — Provider 命名与边界收敛

```text
ChannelAttachmentProvider
+
deprecated ChannelFileProvider alias
```

不改 storage data。

---

## P0-3 — 保留 Legacy extraction

```text
PDF/DOCX/XLSX/TXT
```

继续可读。

标记 compatibility，不继续扩展 ASR/video。

---

## P0-4 — Session ACL 回归强化

```text
cross-session denied
/new denied old attachment
resume allowed
```

---

## P0-5 — 多渠道 attachment contract tests

落入：

```text
channel-testkit
channel-verify
fixtures/*
```

---

## P1-1 — Directional media capabilities

新增：

```text
capabilities.media.inbound/outbound
```

旧字段继续兼容。

---

## P1-2 — Attachment Catalog v2

稳定 logical id -> backend locator。

---

## P1-3 — Native capability seam

只定义接口与 fake。

**不要在 Harness 官方 Generic Attachment 出现前虚构实现。**

---

## P1-4 — Lazy migration

默认关闭，先具备代码与测试。

---

## P2 — Migration/GC CLI

Native Generic Attachment 真正稳定以后再开放。

---

# 41. 预计修改文件

```text
packages/channel-core/
  src/*binary/media helper*
  src/types/*capabilities*

packages/channel-harness/
  src/file-provider.ts
  src/message-converter.ts
  src/bridge.ts
  src/index.ts
  test/*attachment*

packages/channel-files/
  README.md
  src/service.ts
  src/attachment-resolver.ts
  src/attachments/types.ts
  src/attachments/tool-read.ts
  src/catalog/*                 # P1
  src/migration/*               # P1
  test/asset-store.test.ts
  test/tool-read.test.ts
  test/*compat*
  test/*migration*              # P1

packages/channel-telegram/
  src/media-hydrator.ts
  src/inbound.ts
  test/*media*

packages/channel-qq/
  src/image-hydrator.ts
  src/inbound.ts
  test/*media*

packages/channel-lark/
  src/media-hydrator.ts
  src/upstream/media-port.ts
  test/*media*

packages/channel-dingtalk/
  src/inbound.ts
  src/image-hydrator.ts
  src/openapi-port.ts
  test/*media*

packages/channel-weixin/
  test/*media-regression*

packages/channel-testkit/
  src/*binary-ingress-contract*

packages/channel-verify/
  src/*media-capability-check*

packages/channels/
  cordis.patch.yml
  README.md

docs/
  architecture.md
  architecture/common-design.md
  compatibility-matrix.md
  channel-platform-verification.md
```

---

# 42. 文档更新要求

`architecture.md` 增加新的正式边界：

```text
Channel Attachments
= transport + persistence + Session ACL
≠ content understanding
```

`common-design.md` 的 BinaryPart 增加：

> Adapter 对其声明支持且可解析的入站 BinaryPart 应在 emit 前尽最大可能提供 `localData`；是否存在当前 Agent consumer 不得作为跳过 transport hydration 的理由。

`channel-files/README.md` 改为：

```text
Generic Attachment Compatibility Backend
```

并明确：

```text
legacy extraction is compatibility behavior
```

---

# 43. Release / Changeset

P0 建议一个 minor：

```text
@wsz987/channel-core
@wsz987/channel-harness
@wsz987/channel-files
@wsz987/channel-telegram
@wsz987/channel-qq
@wsz987/channel-lark
@wsz987/channel-dingtalk
@wsz987/channel-weixin
@wsz987/channel-testkit
@wsz987/channel-verify
@wsz987/dsh-channels
```

如果只增加可选 capability 字段并保留旧字段：

```text
minor
```

不要把 `ChannelFileProvider` 直接删除，否则会变成 major-level breaking。

---

# 44. Definition of Done

以下全部满足才算完成。

## 架构

- [ ] Adapter 不 import Harness Agent API。
- [ ] `channel-harness` 仍是唯一 Agent / Session boundary。
- [ ] `channel-core` 不落盘、不调用平台 SDK、不调用 Harness。
- [ ] `channel-files` 不新增 ASR/video understanding。
- [ ] DeepSeek Files API 不进入 Channel 层。

## Transport

- [ ] Telegram audio/video 能产生 `localData`。
- [ ] QQ audio/video 能产生 `localData`。
- [ ] Lark audio 能产生 `localData`。
- [ ] Lark video 根据官方 media API 得到明确 `bytes/locator` 能力结论。
- [ ] DingTalk audio/video 根据官方 download API 得到明确 `bytes/locator` 能力结论。
- [ ] Weixin image/file/audio/video regression 全绿。

## Storage

- [ ] 新 generic attachment 继续获得 stable `att-*` id。
- [ ] private store 不进入 workspace。
- [ ] MIME 最终以 bytes 验证。
- [ ] hash integrity 保留。

## Isolation

- [ ] Session A 无法读取 Session B 的 attachment。
- [ ] `/new` 不自动继承旧 Session 附件 ACL。
- [ ] resume 同 Session 仍可读取。
- [ ] outbox resolve 继续校验 Session ACL。
- [ ] Full Access 不绕过 attachment ACL。

## Compatibility

- [ ] `attachments/v1` 原样可读。
- [ ] `read_channel_attachment` 保持兼容。
- [ ] `ChannelFileProvider` import 暂不 breaking。
- [ ] 旧 PDF/DOCX/XLSX extracted data 可继续读取。
- [ ] 升级过程不强制扫描/迁移旧附件。
- [ ] 升级过程不删除旧 bytes。

## Future Native

- [ ] Native generic attachment 只通过 public capability detection 接入。
- [ ] 不通过 Harness version string 猜能力。
- [ ] logical attachment id 与 Harness native id 分离。
- [ ] migration 是 copy + verify。
- [ ] migration failure 自动保持 legacy authoritative。
- [ ] GC 与 migration 分离。

## CI

- [ ] `pnpm build`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm verify`
- [ ] `pnpm check:fixtures`
- [ ] `pnpm check:manifests`
- [ ] `pnpm check:harness-compat`
- [ ] `pnpm check:harness-newer`
- [ ] 多渠道 binary ingress contract tests
- [ ] Session ACL tests
- [ ] legacy v1 compatibility tests

---

# 45. 最终架构决策

本项目最终采用：

> **Channel-neutral Binary Transport + Session-scoped Attachment Gateway + Harness-native Image + Generic Attachment Compatibility Backend + Native-first/Fallback + Stable Logical IDs + Legacy-readable Storage + Lazy Verified Migration**

最终职责如下：

```text
Channel Adapter
= 平台协议 / locator / download / decrypt

Channel Core
= 跨渠道结构化 MessagePart

channel-harness
= Session identity + Agent boundary + Attachment Gateway orchestration

channel-files
= Generic Attachment compatibility backend
  + legacy v1 reader
  + compatibility extraction
  + migration backend

Harness / Skill / Agent Capability
= 内容理解

LLM Adapter
= Provider native file/image transport
```

最重要的长期原则：

> **第六个、第十个、第三十个渠道加入时，只需把平台媒体可靠转换成统一 BinaryPart；不应复制 PDF/ASR/Video 理解逻辑。**

以及：

> **Harness 将来增加 Generic Attachment 后，新附件可以自动切 Native，但旧附件仍然可读、ID 不变、Session ACL 不变、数据不因升级丢失。**

---

# 46. 参考实现事实

本方案核验时主要依据当前仓库：

```text
docs/architecture.md
docs/architecture/common-design.md

packages/channel-harness/src/message-converter.ts
packages/channel-harness/src/file-provider.ts
packages/channel-harness/src/bridge.ts

packages/channel-files/src/attachments/types.ts
packages/channel-files/src/attachments/pipeline.ts
packages/channel-files/src/attachments/tool-read.ts
packages/channel-files/src/attachment-resolver.ts

packages/channel-telegram/src/media-hydrator.ts
packages/channel-qq/src/mapper.ts
packages/channel-qq/src/image-hydrator.ts
packages/channel-lark/src/mapper.ts
packages/channel-lark/src/media-hydrator.ts
packages/channel-dingtalk/src/mapper.ts
packages/channel-dingtalk/src/inbound.ts
packages/channel-weixin/src/messaging/mapper.ts
packages/channel-weixin/src/upstream/tencent-upstream.ts

packages/channels/cordis.patch.yml
```

Harness baseline：

```text
@deepseek-ai/dsh-* = 0.1.1-rc.2
```

当前 Harness 图片附件：

```text
@deepseek-ai/dsh-attachment
ImageAttachmentRef
ImageBlock
DeepSeek Files API image transport
```

Generic File / PDF / Audio / Video 不应在没有官方 public contract 的情况下假装已经 Native。

---

## 一句话执行口径

**现在先把五个渠道的“二进制传递”补完整，把 `channel-files` 保留为 Session 隔离的 Generic Attachment 兼容后端；不要继续在 Channel 里堆理解能力。等 Harness 真正提供 Generic Attachment 时，通过 public capability detection Native-first 接入，旧 `attachments/v1` 永远保留 reader，惰性 copy+verify 迁移，绝不升级即删数据。**
