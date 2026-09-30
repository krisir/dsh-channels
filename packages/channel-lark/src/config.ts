/**
 * Lark adapter configuration (Schemastery).
 *
 * Every deployment-tunable parameter is configurable here — no hardcoded
 * deployment constants. The upstream is ALWAYS the official
 * `@larksuiteoapi/node-sdk`: the Lark AppId is a plain config string
 * (`upstream.appId` — not a secret) while the AppSecret is resolved via
 * `ctx.credentials` (reference `DSH_CHANNEL_LARK_MAIN_APP_SECRET`). The secret
 * value never appears in profile config, logs, or fixtures — only its reference
 * name does.
 *
 * Fail-closed config governance:
 * - `upstream.mode` is a fixed literal `'sdk'`. A legacy config carrying
 *   `mode: 'gateway'` fails config validation (the plugin never enters the
 *   runtime), so no gateway fallback can silently come back.
 * - `baseUrl` / `longPollTimeoutMs` (old self-hosted gateway settings) are
 *   removed from the schema and defaults.
 */
import Schema from '@deepseek-ai/schemastery';
import type { Volatile } from '@deepseek-ai/cordis';

/** Default credential reference name for the Lark AppSecret (web + config default). */
export const LARK_APP_SECRET_REF = 'DSH_CHANNEL_LARK_MAIN_APP_SECRET';

export interface LarkReconnectConfig {
  enabled: boolean;
  baseDelayMs: number;
  maxDelayMs: number;
  maxRetries: number;
}

export interface LarkDedupConfig {
  enabled: boolean;
  windowMs: number;
}

export interface LarkCardConfig {
  /**
   * Create the CardKit streaming card entity on the first streamed delta
   * (eager preview). When `false`, deltas buffer locally and the card is only
   * created at `finish`.
   */
  createOnFirstDelta: boolean;
  /** Add/remove the Feishu `Typing` reaction while generating a reply. */
  typingIndicator: boolean;
}

/**
 * Upstream driver selection. The official `@larksuiteoapi/node-sdk` is the
 * ONLY driver: inbound via its WebSocket long-connection (`WSClient` +
 * `EventDispatcher`, `im.message.receive_v1` / `card.action.trigger`) and
 * outbound via its OpenAPI client, including CardKit 2.0 native streaming.
 * The legacy self-hosted HTTP gateway mode is removed — `mode` is a fixed
 * literal so old `'gateway'` configs fail validation.
 */
export interface LarkUpstreamConfig {
  /** Fixed: the official SDK is the only upstream driver. */
  mode: 'sdk';
  /**
   * Feishu/Lark AppId — a PLAIN config string (not a secret). The web UI writes
   * it through the config endpoint. Defaults to unset.
   */
  appId?: string;
  /**
   * Credential reference name for the Lark AppSecret (resolved via
   * `ctx.credentials`). Defaults to `LARK_APP_SECRET_REF`. Only the
   * reference name lives in config — the value never appears in profile / git.
   */
  appSecretRef?: string;
  /**
   * API domain: 'feishu' | 'lark' | custom base domain. Defaults to 'feishu'
   * (Feishu China).
   */
  domain?: string;
}

export interface LarkConfig {
  enabled: boolean;
  /** Account id within the lark channel (defaults to 'main'). */
  accountId: string;
  /** Per-request timeout. */
  timeoutMs: number;
  reconnect: LarkReconnectConfig;
  dedup: LarkDedupConfig;
  card: LarkCardConfig;
  /** Upstream driver: always the official SDK (detailed above). */
  upstream: LarkUpstreamConfig;
}

/**
 * Activation-time config shape (Harness 0.2.0): every volatile field resolves
 * to a `Volatile<T>` live handle instead of a plain value. `apply()` unwraps
 * these once via `resolveVolatileConfig` into a plain `LarkConfig`.
 *
 * Volatile = the fields the control plane's saveConfig may write at runtime
 * (accountId, reconnect/dedup/card, upstream.appId/upstream.domain, enabled).
 * `timeoutMs` and `upstream.appSecretRef`/`upstream.mode` are not runtime-
 * writable and stay plain.
 */
export interface LarkConfigLive {
  enabled: Volatile<boolean>;
  accountId: Volatile<string>;
  timeoutMs: number;
  reconnect: Volatile<LarkReconnectConfig>;
  dedup: Volatile<LarkDedupConfig>;
  card: Volatile<LarkCardConfig>;
  upstream: Volatile<LarkUpstreamConfig>;
}

// The runtime schema is genuine Schemastery (validation happens at the Loader
// boundary); the annotation records the activation-time output shape. The cast
// is required because Schemastery's inferred ObjectT models per-field optionality
// more precisely than the hand-written `LarkConfigLive` alias.
export const Config = Schema.object({
  // Harness 0.2.0 settings model: fields the control plane / settings page may
  // write at runtime are declared `.volatile()` — they surface on the
  // auto-generated settings form, `ctx.settings.update(entryId, patch)` accepts
  // exactly these paths, and at activation they resolve to `Volatile<T>`
  // handles (unwrapped by `resolveVolatileConfig` in definition.ts / apply()).
  enabled: Schema.boolean().default(true).volatile(),
  accountId: Schema.string().default('main').volatile(),
  timeoutMs: Schema.natural().default(30000),
  reconnect: Schema.object({
    enabled: Schema.boolean().default(true),
    baseDelayMs: Schema.natural().default(1000),
    maxDelayMs: Schema.natural().default(30000),
    maxRetries: Schema.natural().default(10),
  }).default({}).volatile(),
  dedup: Schema.object({
    enabled: Schema.boolean().default(true),
    windowMs: Schema.natural().default(5000),
  }).default({}).volatile(),
  card: Schema.object({
    createOnFirstDelta: Schema.boolean().default(true),
    typingIndicator: Schema.boolean().default(true),
  }).default({}).volatile(),
  upstream: Schema.object({
    // Fixed literal — `mode: 'gateway'` fails validation (fail closed).
    mode: Schema.union(['sdk']).default('sdk'),
    // AppId is a plain (non-secret) config string, written via the config endpoint.
    appId: Schema.string(),
    // Credential reference name only — never the secret value itself.
    appSecretRef: Schema.string().default(LARK_APP_SECRET_REF),
    // 'feishu' | 'lark' | custom base domain (resolved to the SDK Domain).
    domain: Schema.string().default('feishu'),
  }).default({}).volatile(),
}) as unknown as Schema<LarkConfigLive>;
