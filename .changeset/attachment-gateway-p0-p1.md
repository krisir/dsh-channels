---
'@wsz987/channel-core': minor
'@wsz987/channel-harness': minor
'@wsz987/channel-files': minor
'@wsz987/channel-telegram': minor
'@wsz987/channel-qq': minor
'@wsz987/channel-lark': minor
'@wsz987/channel-dingtalk': minor
'@wsz987/channel-weixin': minor
'@wsz987/dsh-channels': minor
---

**Attachment Gateway (P0/P1): directional media capabilities + Generic Attachment compatibility backend.**

- **Directional `capabilities.media`** (`channel-core`): an optional per-kind media map is added to `ChannelCapabilities` — inbound `'bytes' | 'locator' | 'unsupported'`, outbound `'bytes' | 'unsupported'` — alongside the legacy coarse `image` / `file` / `audio` / `video` booleans (retained for compatibility). `channel-verify` now checks `capabilities.media` when a kind claims `'bytes'` (fixtures must prove `localData` before emit).
- **Inbound binary hydration extended to audio/video**: Telegram, QQ, DingTalk and Weixin best-effort hydrate inbound audio/video to `localData`; DingTalk keeps its public audio/video verdict at `locator` pending official documentation plus a real-account live gate. Lark follows its official media API verdict. Hydration runs through the shared protocol-agnostic `applyHydrationResult` helper (`channel-core` media/hydration).
- **Provider rename** (`channel-harness`): `ChannelFileProvider` → `ChannelAttachmentProvider` is now the canonical name, with deprecated `ChannelFile*` aliases (`ChannelFileProvider` / `ChannelFileContext` / `ChannelFileDescriptor`) retained; `installTools` becomes the optional `installCompatibilityTools` (keeps registering `read_channel_attachment` as a compatibility tool).
- **channel-files as Generic Attachment compatibility backend**: session-scoped storage keeps legacy PDF/DOCX/XLSX/TXT extraction as compatibility behavior. Attachment Catalog v2 (`attachments/catalog/v2`), a native capability seam (interface + fake only) and lazy copy+verify migration infrastructure are added **default-off**, to be activated via public capability detection once Harness ships an official native generic attachment surface. Legacy `attachments/v1` remains permanently readable and is never rewritten or deleted on upgrade.
- Multi-channel binary ingress contract runner (`runBinaryIngressContract`) is added to `channel-testkit`.

No breaking changes: legacy capability booleans, `ChannelFile*` exports and existing tool registration semantics remain available.
