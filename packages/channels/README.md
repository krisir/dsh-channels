# @krischoichoi/dsh-channels

DeepSeek Harness **DSH Bundle** — built-in messaging channels:

- Weixin / 微信
- QQ Bot
- DingTalk / 钉钉
- Lark / Feishu / 飞书
- Telegram / 电报（Bot API）

## Install

```bash
npx @deepseek-ai/dsh plugin --profile web add -w @krischoichoi/dsh-channels@latest
```

> The profile directory is itself a pnpm workspace, so `-w` (`--workspace-root`)
> is required to add the bundle to the workspace root (otherwise pnpm fails with
> `ERR_PNPM_ADDING_TO_ROOT`). `@latest` selects the stable release. Run
> `npm view @krischoichoi/dsh-channels dist-tags` to inspect the current `beta` and
> `latest` targets.

The bundle patch (`cordis.patch.yml`) references only entrypoints exported by
`@krischoichoi/dsh-channels` itself. Those entrypoints delegate to the ChannelService,
the generic attachment compatibility backend, Harness bridge, control plane, Web
settings panel and the five channel adapters through the bundle's own dependency
tree. Every channel can be disabled through its plugin config.

## Quick start

```bash
# 1. add the bundle to a profile
npx @deepseek-ai/dsh plugin --profile web add -w @krischoichoi/dsh-channels@latest

# 2. confirm the merged config inserted the channel plugins
npx @deepseek-ai/dsh --profile web --dump-config

# 3. start the profile — all five channels load
npx @deepseek-ai/dsh web
```

## Update and uninstall

```bash
# Install or switch package.json to the latest stable release
npx @deepseek-ai/dsh plugin --profile web add -w @krischoichoi/dsh-channels@latest

# Update within the package.json semver range
npx @deepseek-ai/dsh plugin --profile web update -w @krischoichoi/dsh-channels

# Remove the bundle; also remove any channels-* overrides from your profile patch
npx @deepseek-ai/dsh plugin --profile web remove -w @krischoichoi/dsh-channels
```

Disable a channel you don't use by setting its plugin `enabled` flag to `false`
in your profile patch, e.g. `plugins.channels-weixin.enabled = false`.
See `apps/example/minimal-profile/` in the repository for a reference profile.

## Verify your install

Use a clean profile to confirm the bundle loads end to end (never reuse a dirty
profile for release validation):

```bash
# 1. add the bundle to a clean profile (auto-initializes it on first use)
npx @deepseek-ai/dsh plugin --profile release-validation add -w @krischoichoi/dsh-channels@latest

# 2. dump the merged config — verify the channel plugins were inserted
npx @deepseek-ai/dsh --profile release-validation --dump-config

# 3. start the profile — channels-service / -harness / -control and the five
#    adapters (plus channels-web) should all load without error
npx @deepseek-ai/dsh --profile release-validation
```

## Dependencies

The bundle owns every Harness loader entry and its Web client face. Its npm
`dependencies` provide the implementations behind those entries, so **you only
ever install `@krischoichoi/dsh-channels`**:

| Package                  | Role |
| ------------------------ | ---- |
| `@krischoichoi/channel-core`   | Cross-channel contract + `ChannelService` (`ctx.channels`) |
| `@krischoichoi/channel-harness`| Harness bridge (`SessionBinding`, `AgentManager`, reply pipeline) |
| `@krischoichoi/channel-control`| Config / credentials / auth-session control plane |
| `@krischoichoi/channel-files`  | Generic attachment compatibility backend (store / extract / `read_channel_attachment`) |
| `@krischoichoi/channel-web`    | Web dashboard (`Settings > Channels`) for GUI setup |
| `@krischoichoi/channel-weixin/qq/dingtalk/lark/telegram` | The five channel adapters |

The Web dashboard (`@krischoichoi/channel-web`) declares one dynamic client
dependency (`@deepseek-ai/dsh-client-locale`, provider of the `locale`
service); React, `@deepseek-ai/cordis` and the static UI libraries
(`-ui-primitives`, `-ui-slots`) are shell-owned identities the Harness web app
compiles in — nothing extra to install for that panel beyond a Harness
version that ships them.

## Selecting adapters

The individual adapter packages do not currently carry their own `dsh.bundle`
profile patches, so installing one with `plugin add` is not a complete Harness
setup. Install `@krischoichoi/dsh-channels`, then disable or override unwanted
`channels-*` rows in the profile patch. See `apps/example/minimal-profile/` for
the complete row shapes.

## Architecture

```
Messaging Platform
      │
      ▼
Upstream Driver
      │
      ▼
Channel Adapter (channel-weixin/qq/dingtalk/lark/telegram)
      │
      ▼
ChannelService (Cordis Service, ctx.channels)
      │
      ▼
Harness Bridge (channel-harness)
      │
      ▼
DeepSeek Harness Agent / Session
```

- Adapters never touch `ctx.agents`.
- The Harness bridge is the only place allowed to import Harness public APIs.
- Replies flow from `session/event` back through the bridge to the adapters.

## Development

```bash
pnpm --filter @krischoichoi/dsh-channels build
pnpm --filter @krischoichoi/dsh-channels typecheck
pnpm --filter @krischoichoi/dsh-channels test
```

## Related

- [Repository root](../../README.md)
- [Architecture design](../../docs/architecture.md)

## License

[MIT](../../LICENSE)
