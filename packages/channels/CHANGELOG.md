# @wsz987/dsh-channels

## 0.6.1

### Patch Changes

- 修复首次发布时内部依赖被写成 `workspace:*` 的问题。

  `npm publish` 不会重写 pnpm 的 `workspace:` 协议，导致 0.6.0 各包在 registry 上的
  `dependencies` 仍是 `"@krischoichoi/channel-*": "workspace:*"`，消费者安装即失败。
  本版本改用仓库自带的 `pnpm release:pack` / `pnpm release:publish` 管线（内部 `pnpm pack`
  会写入真实版本号，`assertPackedManifest` 会在发布前拦截 `workspace:` 残留）。

- Updated dependencies
  - @krischoichoi/channel-core@0.6.1
  - @krischoichoi/channel-control@0.6.1
  - @krischoichoi/channel-harness@0.6.1
  - @krischoichoi/channel-files@0.6.1
  - @krischoichoi/channel-web@0.6.1
  - @krischoichoi/channel-weixin@0.6.1
  - @krischoichoi/channel-qq@0.6.1
  - @krischoichoi/channel-dingtalk@0.6.1
  - @krischoichoi/channel-lark@0.6.1
  - @krischoichoi/channel-telegram@0.6.1

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

- Updated dependencies [41ef1ef]
- Updated dependencies [da8e44d]
- Updated dependencies [08622da]
- Updated dependencies [41ef1ef]
  - @krischoichoi/channel-dingtalk@0.6.0
  - @krischoichoi/channel-harness@0.6.0
  - @krischoichoi/channel-core@0.6.0
  - @krischoichoi/channel-control@0.6.0
  - @krischoichoi/channel-files@0.6.0
  - @krischoichoi/channel-web@0.6.0
  - @krischoichoi/channel-qq@0.6.0
  - @krischoichoi/channel-weixin@0.6.0
  - @krischoichoi/channel-lark@0.6.0
  - @krischoichoi/channel-telegram@0.6.0

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
- d0df3dc: Add canonical conversation discovery for access-policy configuration, including
  QQ group OpenID discovery and an explicit Web refresh control. Normalize QQ and
  DingTalk activation facts used by the shared access layer, and update Lark
  interactive question actions to the official Card 2.0 callback-button schema.
- 9d7f651: **QQ native inline keyboard + interaction round-trip for `ask_user_question` (P1).**

  - **`interactiveActions: true`** — QQ adapter now declares native interactive actions: `OutboundMessage.actions` map to the new QQ Markdown inline keyboard (`msg_type=2` + `markdown.content` + `keyboard`, callback action type `1`) and button presses emit a canonical `interaction.received` for the Harness question presenter.
  - **Outbound**: new `toQqKeyboard` mapper (`OutboundActionRow[]` → QQ `InlineKeyboard`); the opaque `uq_*` action id rides in `action.data` (echoed back as `button_data`) and the button `id`; `primary` style maps to QQ style 1, all other styles to default (never invents unsupported values). Media + actions degrades to a plain media send (QQ does not reliably support buttons on media sends) with a debug note.
  - **Inbound**: `QQSdkClient` seam extended with `onInteraction` / `sendMarkdownWithKeyboard` / `acknowledgeInteraction`; the adapter ACKs every interaction within the ~5s platform window (fire-and-forget, before Harness resolution), zod-validates the untrusted `InteractionEvent` slice at the trust boundary, and emits `interaction.received` with the conversation/sender derived from the QQ openids (C2C `user_openid`; group `group_openid` + `group_member_openid`). Ambiguous or invalid payloads fail closed (logged drop, never a guessed event). Authorization stays in `channel-harness`'s Access Gate — the adapter only emits canonical events.
  - **New QQ group activation**: `GROUP_AT_MESSAGE_CREATE` now maps to strict `activation.mentionedBot=true` and strips the leading platform mention marker. An authorized `@机器人 2` answer is consumed by the pending Harness question before ordinary Agent queueing.
  - **Minimal intents**: the Tencent client now passes an explicit `intents` mask (`GROUP_AND_C2C | INTERACTION` = `(1 << 25) | (1 << 26)`) instead of relying on the SDK `FULL_INTENTS` default, per the minimal-intent principle.

  Offline contract suite (Fake QQSdkClient) is green; a real QQ app live gate is still required before production use (button display, press callback, ACK).

- Updated dependencies [f085a55]
- Updated dependencies [6919d3e]
- Updated dependencies [d0df3dc]
- Updated dependencies [bb03191]
- Updated dependencies [213fd5c]
- Updated dependencies [363e49a]
- Updated dependencies [9d7f651]
- Updated dependencies [9d7f651]
  - @wsz987/channel-core@0.5.1
  - @wsz987/channel-harness@0.5.1
  - @wsz987/channel-files@0.5.1
  - @wsz987/channel-telegram@0.5.1
  - @wsz987/channel-qq@0.5.1
  - @wsz987/channel-lark@0.5.1
  - @wsz987/channel-dingtalk@0.5.1
  - @wsz987/channel-weixin@0.5.1
  - @wsz987/channel-control@0.5.1
  - @wsz987/channel-web@0.5.1

## 0.4.2

### Patch Changes

- Add Telegram Bot API 10.2 Rich Markdown rendering and draft streaming, generic
  channel actions, callback-query interactions, and the Harness ApiProxy bridge
  for interactive user questions.
- Keep Telegram Rich Markdown byte-limit segmentation fast under concurrent CI
  load by reusing parser source ranges and avoiding redundant serialization.
- Updated dependencies
  - @wsz987/channel-core@0.4.2
  - @wsz987/channel-harness@0.4.2
  - @wsz987/channel-telegram@0.4.2
  - @wsz987/channel-control@0.4.2
  - @wsz987/channel-dingtalk@0.4.2
  - @wsz987/channel-files@0.4.2
  - @wsz987/channel-lark@0.4.2
  - @wsz987/channel-qq@0.4.2
  - @wsz987/channel-web@0.4.2
  - @wsz987/channel-weixin@0.4.2
