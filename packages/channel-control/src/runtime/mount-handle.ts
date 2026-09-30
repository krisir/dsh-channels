/**
 * Re-export of the core [ChannelMountHandle] disposer.
 *
 * The type itself lives in @krischoichoi/channel-core (returned by
 * mountChannelAdapter); this module keeps the plan's runtime/ directory shape
 * (doc §12, §22) while re-exporting the canonical type. channel-control never
 * re-implements lifecycle: it stores these handles in a Map keyed by
 * channelId:accountId and calls dispose() on demand.
 */
export type { ChannelMountHandle } from '@krischoichoi/channel-core';
