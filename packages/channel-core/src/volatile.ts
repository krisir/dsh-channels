/**
 * Harness 0.2.0 volatile-config resolution helpers.
 *
 * Harness 0.2.0 replaced the 0.1.x `settings.register()` namespace model with
 * `SettingsForms`: a settings page is derived from the plugin entry's static
 * `Config` schema, and only schema fields marked `.volatile()` (Schemastery)
 * are editable / writable through `ctx.settings.update(entryId, patch)`.
 *
 * The trade-off: at activation time every volatile field resolves to a
 * `Volatile<T>` live handle (read via `.get()`), not the plain value. Adapters
 * that snapshot their config at definition-construction time must unwrap these
 * handles first — that is what `resolveVolatileConfig` does.
 *
 * These helpers only depend on structural typing (a handle is any object with
 * a callable `get`), so they stay testable without importing Harness internals
 * (architecture red line 12: public API shapes only).
 */

/** Structural shape of a Cordis `Volatile<T>` handle (cosmokit). */
interface VolatileRef<T = unknown> {
  get(): T;
}

/** Whether a runtime config value is a volatile live handle. */
function isVolatileRef(value: unknown): value is VolatileRef {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { get?: unknown }).get === 'function'
  );
}

/**
 * Unwrap one config value: a volatile handle becomes its current snapshot,
 * anything else passes through unchanged.
 */
export function resolveVolatileValue<T>(value: T): T {
  return isVolatileRef(value) ? (value.get() as T) : value;
}

/**
 * Resolve a runtime config object into plain values by unwrapping every
 * top-level volatile field. Sub-objects declared volatile resolve wholesale
 * through their own handle; plain sub-objects are copied as-is.
 *
 * Adapters call this once when building their definition config snapshot
 * (`snapshotOf`-style copies), so downstream code keeps reading plain fields.
 */
export function resolveVolatileConfig<T extends object>(config: T): T {
  const resolved = { ...config } as Record<string, unknown>;
  for (const [key, value] of Object.entries(resolved)) {
    resolved[key] = resolveVolatileValue(value);
  }
  return resolved as T;
}
