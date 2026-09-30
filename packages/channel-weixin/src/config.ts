/**
 * Weixin adapter configuration (Schemastery).
 *
 * Per doc section 29 — the channels-weixin config exposes iLink base URLs,
 * network timeouts and reconnect policy. Credentials are NEVER configured in
 * YAML; they live in the read/write credential store resolved at start.
 */
import Schema from '@deepseek-ai/schemastery';
import type { Volatile } from '@deepseek-ai/cordis';
import { DEFAULT_BASE_URL, DEFAULT_CDN_BASE_URL } from './ilink/constants.js';

export interface WeixinIlinkConfig {
  /** API base URL; may be redirected per-account after QR login. */
  baseUrl: string;
  /** CDN base URL for media. */
  cdnBaseUrl: string;
  /** bot_agent value sent in base_info. */
  botAgent?: string;
}

export interface WeixinNetworkConfig {
  /** Per-request timeout in ms. */
  timeoutMs: number;
  /** Initial getUpdates long-poll timeout in ms. */
  longPollTimeoutMs: number;
}

export interface WeixinReconnectConfig {
  enabled: boolean;
  baseDelayMs: number;
  maxDelayMs: number;
}

export interface WeixinConfig {
  enabled: boolean;
  /** Local DSH account alias; default 'main'. */
  accountId: string;
  ilink: WeixinIlinkConfig;
  network: WeixinNetworkConfig;
  reconnect: WeixinReconnectConfig;
}

/**
 * Activation-time config shape (Harness 0.2.0): volatile fields resolve to a
 * `Volatile<T>` live handle instead of a plain value. `apply()` unwraps them
 * once via `resolveVolatileConfig` into a plain `WeixinConfig`. Weixin has no
 * runtime-writable config beyond the enabled intent, so `enabled` is the only
 * volatile field.
 */
export interface WeixinConfigLive {
  enabled: Volatile<boolean>;
  accountId: string;
  ilink: WeixinIlinkConfig;
  network: WeixinNetworkConfig;
  reconnect: WeixinReconnectConfig;
}

// The runtime schema is genuine Schemastery (validation happens at the Loader
// boundary); the annotation records the activation-time output shape. The cast
// is required because Schemastery's inferred ObjectT models per-field optionality
// more precisely than the hand-written `WeixinConfigLive` alias.
export const Config = Schema.object({
  // Harness 0.2.0 settings model: fields the control plane / settings page may
  // write at runtime are declared `.volatile()` — `ctx.settings.update(
  // entryId, patch)` accepts exactly these paths, and at activation they
  // resolve to `Volatile<T>` handles (unwrapped by `resolveVolatileConfig`).
  enabled: Schema.boolean().default(true).volatile(),
  accountId: Schema.string().default('main'),
  ilink: Schema.object({
    baseUrl: Schema.string().default(DEFAULT_BASE_URL).description('Weixin iLink API base URL'),
    cdnBaseUrl: Schema.string().default(DEFAULT_CDN_BASE_URL).description('Weixin CDN base URL'),
    botAgent: Schema.string().description('bot_agent value for base_info'),
  }),
  network: Schema.object({
    timeoutMs: Schema.natural().default(15000),
    longPollTimeoutMs: Schema.natural().default(35000),
  }),
  reconnect: Schema.object({
    enabled: Schema.boolean().default(true),
    baseDelayMs: Schema.natural().default(2000),
    maxDelayMs: Schema.natural().default(30000),
  }),
}) as unknown as Schema<WeixinConfigLive>;
