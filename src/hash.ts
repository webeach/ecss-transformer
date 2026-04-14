import { createHash } from 'node:crypto';

/**
 * Default class-name template when none is provided by the user.
 * `[name]` expands to the state-def identifier; `[hash:6]` to the first 6 hex
 * characters of the SHA-256 digest of `"<filePath>:<stateDefName>"`.
 */
const DEFAULT_TEMPLATE = '[name]-[hash:6]';

/**
 * Computes a deterministic SHA-256 hash for a given file + state-def pair.
 *
 * The hash is used both in the generated CSS class name (via {@link applyTemplate})
 * and in the `data-e-<hash>-*` attribute names so that they stay in sync.
 *
 * @param filePath     Absolute or project-relative path to the `.ecss` source file.
 * @param stateDefName Identifier of the `@state-def` (e.g. `"button"`).
 * @returns Full hex SHA-256 digest string (64 chars).
 */
export function computeHash(filePath: string, stateDefName: string): string {
  return createHash('sha256')
    .update(`${filePath}:${stateDefName}`)
    .digest('hex');
}

/**
 * Applies a class-name template, substituting `[name]` and `[hash:N]` tokens.
 *
 * Supported tokens:
 * - `[name]`     — replaced with the state-def identifier.
 * - `[hash]`     — replaced with the first 6 characters of `hash`.
 * - `[hash:N]`   — replaced with the first `N` characters of `hash`.
 *
 * @param template Custom template string, or `undefined` to use the default.
 * @param name     State-def identifier (value for `[name]`).
 * @param hash     Full SHA-256 hex digest produced by {@link computeHash}.
 * @returns Generated CSS class name.
 */
export function applyTemplate(
  template: string | undefined,
  name: string,
  hash: string,
): string {
  const tmpl = template ?? DEFAULT_TEMPLATE;
  return tmpl
    .replace(/\[name]/g, name)
    .replace(/\[hash(?::(\d+))?]/g, (_match, len: string | undefined) => {
      const length = len ? Number.parseInt(len, 10) : 6;
      return hash.slice(0, length);
    });
}
