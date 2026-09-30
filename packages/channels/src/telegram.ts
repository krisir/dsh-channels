import * as channel from '@krischoichoi/channel-telegram';

/**
 * Loader entry plugin for `channels-telegram`.
 *
 * Harness 0.2.0 derives the auto-generated settings page from the plugin's
 * static `Config` schema (cordis `Plugin.Base.Config`), so the entry exports
 * an object plugin carrying `name` / `inject` / `Config` beside `apply`. The
 * named re-exports below stay for programmatic consumers and tests.
 */
const plugin = {
  name: channel.name,
  inject: channel.inject,
  Config: channel.Config,
  apply: channel.apply,
};

export default plugin;
export * from '@krischoichoi/channel-telegram';
