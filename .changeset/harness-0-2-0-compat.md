---
'@krischoichoi/dsh-channels': minor
'@krischoichoi/channel-core': minor
'@krischoichoi/channel-harness': minor
'@krischoichoi/channel-control': minor
'@krischoichoi/channel-files': minor
'@krischoichoi/channel-web': minor
'@krischoichoi/channel-qq': minor
'@krischoichoi/channel-weixin': minor
'@krischoichoi/channel-dingtalk': minor
'@krischoichoi/channel-lark': minor
'@krischoichoi/channel-telegram': minor
---

适配 DeepSeek Harness `0.2.0-rc.2`（含桌面端），基线精确 pin 从 `0.1.5-rc.2` 上调。

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
