/**
 * QQ adapter configuration (Schemastery).
 *
 * V1 consumes the official Tencent SDK `@tencent-connect/qqbot-nodejs`, which
 * owns Token acquisition/refresh, the WebSocket gateway (hello/identify/
 * heartbeat/RESUME/reconnect) and the OpenAPI REST surface. The adapter only
 * needs the AppId and behavioural tuning — no base URL, transport, reconnect
 * budget or QR auth config.
 *
 * The real AppSecret is **never** written into config / profile / git. Config
 * only carries its credential reference name (`appSecretRef`); the actual
 * secret is resolved at startup through `ctx.credentials` (v1.1 §6.2, QQ-R5).
 */
import Schema from '@deepseek-ai/schemastery';
import type { Volatile } from '@deepseek-ai/cordis';

export const QQ_APP_SECRET_REF = 'QQBOT_APP_SECRET';

export interface QQStreamingConfig {
  /** Whether incremental outbound streaming is enabled. */
  enabled: boolean;
  /** Stream flush throttle (ms). Tencent SDK: default 500, min 300. */
  throttleMs: number;
}

export interface QQDedupConfig {
  enabled: boolean;
  windowMs: number;
}

export interface QQConfig {
  enabled: boolean;
  /** Account id within the qq channel (defaults to 'main'). */
  accountId: string;
  /** QQ Open Platform AppId (not a secret — may live in config/git). */
  appId: string;
  /**
   * Credential reference name for the QQ Open Platform AppSecret (e.g.
   * `'QQBOT_APP_SECRET'`). Only the reference — never the real secret — is
   * stored here; the secret is resolved via `ctx.credentials` at startup.
   */
  appSecretRef: string;
  /** Whether ordinary bot replies may use Markdown. Interactive keyboard questions use the new QQ Markdown wire format regardless. */
  markdownSupport: boolean;
  streaming: QQStreamingConfig;
  dedup: QQDedupConfig;
  /** How long start() waits for the SDK `ready` event before failing. */
  startupTimeoutMs: number;
}

/**
 * Activation-time config shape (Harness 0.2.0): every volatile field resolves
 * to a `Volatile<T>` live handle instead of a plain value. `apply()` unwraps
 * these once via `resolveVolatileConfig` into a plain `QQConfig`.
 */
export interface QQConfigLive {
  enabled: Volatile<boolean>;
  accountId: Volatile<string>;
  appId: Volatile<string>;
  appSecretRef: string;
  markdownSupport: Volatile<boolean>;
  streaming: Volatile<QQStreamingConfig>;
  dedup: Volatile<QQDedupConfig>;
  startupTimeoutMs: Volatile<number>;
}

// The runtime schema is genuine Schemastery (validation happens at the Loader
// boundary); the annotation records the activation-time output shape. The cast
// is required because Schemastery's inferred ObjectT models per-field optionality
// more precisely than the hand-written `QQConfigLive` alias.
export const Config = Schema.object({
  // Harness 0.2.0 settings model: fields the control plane / settings page may
  // write at runtime are declared `.volatile()` — they surface on the
  // auto-generated settings form, `ctx.settings.update(entryId, patch)` accepts
  // exactly these paths, and at activation they resolve to `Volatile<T>`
  // handles (unwrapped by `resolveVolatileConfig` in definition.ts / apply()).
  enabled: Schema.boolean().default(true).volatile(),
  accountId: Schema.string().default('main').volatile(),
  // QQ Open Platform AppId (not a secret — may live in config/git).
  appId: Schema.string().volatile(),
  // Credential reference name only — never the secret value itself.
  appSecretRef: Schema.string().default(QQ_APP_SECRET_REF),
  markdownSupport: Schema.boolean().default(false).volatile(),
  streaming: Schema.object({
    enabled: Schema.boolean().default(true),
    throttleMs: Schema.natural().min(300).default(500),
  }).default({}).volatile(),
  dedup: Schema.object({
    enabled: Schema.boolean().default(true),
    windowMs: Schema.natural().default(5000),
  }).default({}).volatile(),
  startupTimeoutMs: Schema.natural().default(15000).volatile(),
}) as unknown as Schema<QQConfigLive>;
