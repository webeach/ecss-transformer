/**
 * Compact runtime descriptor for a single state parameter.
 *
 * Encoded as a tuple to minimise bundle size in the generated JS output:
 * - `[0]` camelName    — JS property name used when calling the state function.
 * - `[1]` attrName     — `data-e-<hash>-<param>` attribute set on the host element.
 * - `[2]` type         — `'b'` (boolean) or `'v'` (variant string).
 * - `[3]` defaultValue — value applied when the caller omits the argument.
 */
type ParamDef = [
  camelName: string,
  attrName: string,
  type: 'b' | 'v',
  defaultValue: boolean | string | undefined,
];

/** The object returned by a state function — spread directly onto a JSX element or DOM node. */
type StyleResult = Record<string, string | undefined>;

/**
 * Creates a state function for a single `@state-def`.
 *
 * The returned function accepts parameters either positionally or as a named
 * object (the runtime detects which form is used at call time) and produces a
 * `StyleResult` ready to be spread onto a component.
 *
 * @param className   The generated CSS class name for this state-def.
 * @param params      Compact parameter descriptors produced by the JS emitter.
 * @param classFields Which result keys should contain the class name
 *                    (`['className']` for React, `['class']` for Vue/Svelte/Solid,
 *                    `['class', 'className']` for both).
 */
export function _h(
  className: string,
  params: ParamDef[],
  classFields: string[] = ['className'],
): (...args: any[]) => StyleResult {
  return function (...args: any[]): StyleResult {
    const values = resolveArgs(params, args);
    const result: StyleResult = {};

    // Always include the class name under each requested field.
    for (const field of classFields) {
      result[field] = className;
    }

    // Map each resolved parameter value to its data attribute.
    for (const [camel, attr, type] of params) {
      const val = values[camel];
      if (type === 'b') {
        // Boolean params: present as empty string when truthy, absent when falsy.
        result[attr] = val ? '' : undefined;
      } else if (val != null) {
        result[attr] = String(val);
      }
    }

    return result;
  };
}

/**
 * Resolves call arguments into a `{ camelName → value }` map, applying
 * per-parameter defaults for any argument that was not supplied.
 *
 * Supports two calling conventions:
 * - **Named-object**: `fn({ isActive: true, size: 'lg' })`
 *   Detected when the first argument is a non-null, non-array plain object.
 * - **Positional**: `fn(true, 'lg')`
 *   Each argument maps to the parameter at the same index.
 */
function resolveArgs(params: ParamDef[], args: any[]): Record<string, any> {
  const result: Record<string, any> = {};

  const isNamedObject =
    args.length === 1 &&
    typeof args[0] === 'object' &&
    args[0] !== null &&
    !Array.isArray(args[0]);

  if (isNamedObject) {
    const obj = args[0] as Record<string, any>;
    for (const [camel, , , def] of params) {
      result[camel] = obj[camel] !== undefined ? obj[camel] : def;
    }
  } else {
    for (let i = 0; i < params.length; i++) {
      const [camel, , , def] = params[i];
      result[camel] = args[i] !== undefined ? args[i] : def;
    }
  }

  return result;
}

/**
 * Merges multiple `StyleResult` objects into one.
 *
 * - `class` / `className` values are **concatenated** with a space so that
 *   multiple component classes can coexist on the same element.
 * - All other keys (data attributes) are **overwritten** by the last object
 *   that supplies a non-`undefined` value, allowing later calls to override
 *   earlier defaults.
 *
 * @example
 * const combined = merge(button(), icon({ size: 'sm' }));
 * // → { className: 'button-abc123 icon-def456', 'data-e-def456-size': 'sm' }
 */
export function merge(...objects: StyleResult[]): StyleResult {
  const result: StyleResult = {};

  for (const obj of objects) {
    for (const key in obj) {
      if (key === 'class' || key === 'className') {
        result[key] = result[key] ? `${result[key]} ${obj[key]}` : obj[key];
      } else if (obj[key] !== undefined) {
        result[key] = obj[key];
      }
    }
  }

  return result;
}
