# @wsz987/channel-harness

## 0.6.0

### Minor Changes

- da8e44d: 适配 DeepSeek Harness `0.2.0-rc.2`（含桌面端），基线精确 pin 从 `0.1.5-rc.2` 上调。

  - **settings 模型迁移**：Harness 0.2.0 删除 `settings.register()`（SettingsProvider/SettingsScope），
    `ctx.settings` 变为 `SettingsForms`——设置页从各 Loader entry 的静态 `Config` schema 派生，
    只有 volatile 字段可在线编辑、写回 profile patch。五个渠道适配器删除 register/scope 模式：
    Config schema 的控制面可写字段（enabled / appId / clientId / accountId 等）标记
    `.volatile()`，激活期 `Volatile<T>` 句柄由 `channel-core` 新增的
    `resolveVolatileConfig` / `resolveVolatileValue` 解包；`persistEnabled` / `persistSetup`
    改写为 `settings.update('<entryId>', patch)`。各 bundle 入口暴露带 `Config` 的
    default 插件对象，桌面端 / Web「设置 → 渠道」的自动设置表单因此可用。
  - **agent-presets 更名**：`@deepseek-ai/dsh-agent-presets` 在 0.2.0 不存在；
    `channel-harness` 改从 `@deepseek-ai/dsh-agent-preset-registry` 导入
    `agentPresetProjectionDefinition` 与 `AgentPresetRegistry`（修复 channels-harness /
    channels-files 在 0.2.0 上 failed to import）。
  - **依赖基线**：全部 `@deepseek-ai/dsh-*` pin 至 `0.2.0-rc.2`，cordis `^4.0.4`，
    schemastery `~3.18.4`（volatile API 所需）；移除 0.2.0 线不存在的
    `@deepseek-ai/dsh-code-runtime` 依赖（无代码引用）。
  - **channel-web**：`IconTriangleRightFill14` → `IconTriangleRightFillMedium`（0.2.0 primitives 改名）。
  - 兼容矩阵：0.5.1 仅匹配 Harness `0.1.5-rc.2`，在 0.2.0 上无法激活；本线（0.6.0）起匹配 `0.2.0-rc.2`。

### Patch Changes

- 41ef1ef: 修复钉钉 `ask_user_question` 总是回「无法在当前渠道展示问题，已取消。」

  钉钉协议**支持**卡片按钮问答（互动卡片「回传请求」+ STREAM 回调），但按钮要求卡片模板
  已在本组织卡片平台发布、且含 `text`/`actions` 变量。此前 `card.interactiveTemplateId`
  有内置默认值（第三方 Claw Bot AI Card 模板），SDK 模式下 `interactiveActions` 因此对任何
  默认配置都是 `true`，卡片发送在该模板不存在/变量不匹配时抛错，而 presenter 直接取消问题。

  - `channel-dingtalk`：`card.interactiveTemplateId` 取消内置默认（fail closed）。未显式
    配置即 `interactiveActions: false`，问题走编号文字回复（与微信一致）；`02fcf2f4-…`
    常量仅保留给流式 AI Card 路径。gateway 模式永不声明按钮能力。
  - `channel-harness`（通用，非渠道特判）：actions 模式发送失败时，把该批问题降级为
    `text` 并重新渲染发送（带上「回复 1/2/3」说明与群聊关联码），只有文字也失败才取消。
    QQ / Telegram / Lark 同样受益。
  - 回归测试覆盖两种降级路径与「默认不声明按钮能力」。

- 08622da: 清理残留的旧描述（仅注释，无 API 变化）。

  - 移除只讲述历史演进的注释（旧 provider / ApiProxy / `resolveSessionPreset` / 旧网关等），
    改为描述当前契约。
  - 修正 `ChannelWorkspaceAttachError` 文档注释中重复的 “soft-attach semantics” 短语。
    该导出**保留不动**：它是已发布版本（0.5.0）的公开 API 面，`@deprecated` 兼容 shim 是有意
    保留的，删除会影响下游 `instanceof` / catch。

- 41ef1ef: 修复渠道 `ask_user_question` 全渠道失效（Web profile 下问题被官方 Remote answerer 吞掉）。

  0.1.2 起官方问题域改为 `user-questions/request` waterfall（串行、先认领者胜），
  官方 `@deepseek-ai/dsh-api-remotes` 在 web profile 开机即注册转发 answerer，早于
  `channels-harness`，因此普通 `ctx.on()` 注册的渠道 answerer 永远排在后面：有浏览器
  连接时问题被 Web UI 认领并挂起，无连接时请求 park 在 `pendingRemoteEvents`，渠道
  （含微信文字兜底）两种情况下都收不到问题。

  - `WaterfallQuestionBackend` 改用 `{ prepend: true }` 注册：渠道能展示就认领
    （按钮或编号文字兜底），不能展示仍 `next()` 委托官方 Web answerer。
  - 启动探测 `ctx.userQuestions` 失败不再永久关闭渠道问答，只 `warn`：服务可能晚于
    bridge 挂载（profile 行并发创建 / patch 热重载），answerer 本身只需要根 context。
  - 新增「Web answerer 先注册，渠道仍须拿到问题」与「渠道 decline 后仍到达 Web
    answerer」回归测试。

- Updated dependencies [da8e44d]
  - @krischoichoi/channel-core@0.6.0

## 0.5.1

### Minor Changes

- f085a55: **Attachment Gateway (P0/P1): directional media capabilities + Generic Attachment compatibility backend.**

  - **Directional `capabilities.media`** (`channel-core`) joins the legacy coarse
    `image` / `file` / `audio` / `video` booleans: per kind, inbound is
    `'bytes' | 'locator' | 'unsupported'` and outbound is `'bytes' | 'unsupported'`.
    `channel-verify` checks it whenever a kind claims `'bytes'`.
  - **Inbound binary hydration extended to audio/video** across Telegram, QQ,
    DingTalk and Weixin (DingTalk keeps a `locator` verdict pending a real-account
    live gate; Lark follows its official media API verdict).
  - **Provider rename** (`channel-harness`): `ChannelFileProvider` →
    `ChannelAttachmentProvider`, with the `ChannelFile*` names kept as deprecated
    aliases and `installTools` → the optional `installCompatibilityTools`.
  - **`channel-files` is the Generic Attachment compatibility backend**: legacy
    PDF/DOCX/XLSX/TXT extraction is retained, Attachment Catalog v2 and the
    copy+verify migration infrastructure ship **default-off**, and legacy
    `attachments/v1` data stays permanently readable (never rewritten or deleted).

  No breaking changes: legacy capability booleans, `ChannelFile*` exports and
  existing tool registration semantics remain available.

- 213fd5c: **DeepSeek Harness `0.1.5-rc.2` baseline — opens the 0.5.x release line (BREAKING).**

  0.5.x is version-line compatible with Harness `0.1.5-rc.2`, **not** runtime
  dual-compatible: on Harness `0.1.0-rc.7` / `0.1.1-rc.2` stay on
  `@wsz987/dsh-channels@0.4.2`. Upgrade the Harness CLI first, then reinstall the
  bundle. Full version/Node matrix and the per-scenario verification table live in
  [`docs/compatibility-matrix.md`](https://github.com/wsz987/dsh-channels/blob/main/docs/compatibility-matrix.md);
  the rc.1/rc.2 API diff record is in
  [`docs/harness-0.5.x-migration-plan.md`](https://github.com/wsz987/dsh-channels/blob/main/docs/harness-0.5.x-migration-plan.md).

  What breaking changes require attention on upgrade:

  - **Minimum Harness `0.1.5-rc.2`** (exact pins, no carets) and **minimum Node 22.19**.
  - **ApiProxy is gone** — the `channels-harness` inject no longer lists it; host
    model selection goes through `ctx.sessionController`.
  - **User Questions ride the official `user-questions/request` waterfall** — the
    ApiProxy mux and direct `UserQuestionProvider` backends are retired; a declined
    channel presentation delegates via `next()`.
  - **Durable reads use `sessionPersistence.open(id, 'read')`** — `persistence.inspect()`
    and `Session.events` are gone (`snapshotEvents()` instead).
  - **Unknown slash commands are rejected** instead of reaching the model.
  - Remove `imageCompatibility` from any existing config; image visibility is now
    decided entirely by the official Harness Image Pipeline.

  Also in this line: `/version` plus a prompt-only Web update check, `/mirror on|off`
  (opt-in web-turn mirroring, issue #5), `/bind <id> [confirm]` (issue #6), working
  outbound image sends through the channel asset store (issue #7), and durable
  bindings that survive restarts (issue #8).

### Patch Changes

- 6919d3e: Channel-triggered Harness turns that terminate with
  `turn/end.reason.kind = "error"` now return a safe terminal failure notice to
  the originating channel. `AUTH` failures hide raw provider diagnostics and
  display `API key is invalid`. No-output terminal turns also stop typing
  indicators correctly. Structured `QUOTA` diagnostics prefer their validated
  provider message over the raw status and JSON envelope.
- bb03191: Restrict every group-chat slash command to the access policy owner. Missing or
  mismatched owner identity now denies the command before `/stop`, session,
  binding, workspace, or Agent side effects while leaving ordinary group messages
  under the existing access policy.
- 9d7f651: `ask_user_question` 统一文本兜底（P0）：`interactiveActions` 不再作为问题准入条件，
  只要渠道 `text: true` 即可通过编号文字完成问答；`interactiveActions: true` 仅升级为
  原生按钮展示。非按钮渠道（Weixin / QQ / DingTalk / Lark）现在会收到编号选项文本
  （`1. xxx`，无 description 也始终渲染），支持数字 / 选项文字 / 自定义 / `跳过` /
  多选 `1,3` 回答；群聊文字回答支持平台 `replyTo` 或每道题生成的短关联码
  （`Q-XXXXXX`）两种关联方式；越界多选输入提示重新输入而不取消整个问题。
  Telegram 原生按钮 + ForceReply 路径保持不变。
- Updated dependencies [f085a55]
- Updated dependencies [d0df3dc]
- Updated dependencies [213fd5c]
  - @wsz987/channel-core@0.5.1

## 0.4.2

### Patch Changes

- Add Telegram Bot API 10.2 Rich Markdown rendering and draft streaming, generic
  channel actions, callback-query interactions, and the Harness ApiProxy bridge
  for interactive user questions.
- Updated dependencies
  - @wsz987/channel-core@0.4.2
