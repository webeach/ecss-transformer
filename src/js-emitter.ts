import type { ClassAttribute, ResolvedStateDef } from './types.js';

/** Module specifier used when no explicit `runtimeImport` is provided. */
const DEFAULT_RUNTIME_IMPORT = 'virtual:ecss/runtime';

/**
 * Returns the `classFields` array literal for the `_h` runtime call.
 *
 * The array tells the runtime which keys (`'class'`, `'className'`, or both)
 * to include in the result object returned by the state function.
 */
function classFieldsLiteral(classAttribute: ClassAttribute): string {
  if (classAttribute === 'class') {
    return `['class']`;
  }
  if (classAttribute === 'both') {
    return `['class', 'className']`;
  }
  return `['className']`;
}

/**
 * Generates the JS module source for all resolved `@state-def` entries.
 *
 * The emitted code imports `_h` and `merge` from the runtime and calls `_h`
 * once per state-def to create a typed state function. Parameters are encoded
 * as compact tuples:
 *
 * ```
 * ['camelName', 'data-e-<hash>-<param>', '<type>', <default>]
 * //  ↑ JS prop   ↑ HTML attribute         ↑ 'b'|'v'  ↑ typed default
 * ```
 *
 * where `'b'` = boolean and `'v'` = variant.
 *
 * The module always exports a default object containing every state function
 * plus the `merge` helper.
 *
 * @param resolvedDefs   List of resolved state-def descriptors.
 * @param runtimeImport  Custom module specifier for the runtime (default: `"virtual:ecss/runtime"`).
 * @param classAttribute Which class field(s) to include in result objects (default: `"className"`).
 */
export function emitJs(
  resolvedDefs: ResolvedStateDef[],
  runtimeImport?: string,
  classAttribute: ClassAttribute = 'className',
): string {
  const importPath = runtimeImport ?? DEFAULT_RUNTIME_IMPORT;
  const classFields = classFieldsLiteral(classAttribute);
  const lines: string[] = [];

  if (resolvedDefs.length > 0) {
    lines.push(`import { _h, merge } from '${importPath}';`);
    lines.push('');
  }

  for (const def of resolvedDefs) {
    // Build the compact parameter tuple for each param.
    const paramEntries = def.params.map((pr) => {
      const type = pr.type === 'boolean' ? 'b' : 'v';
      const defaultVal =
        typeof pr.defaultValue === 'boolean'
          ? String(pr.defaultValue)
          : pr.defaultValue !== undefined
            ? `'${pr.defaultValue}'`
            : 'undefined';
      return `['${pr.camelName}', '${pr.attrName}', '${type}', ${defaultVal}]`;
    });

    if (paramEntries.length === 0) {
      lines.push(
        `const ${def.name} = _h('${def.className}', [], ${classFields});`,
      );
    } else {
      lines.push(`const ${def.name} = _h('${def.className}', [`);
      for (const entry of paramEntries) {
        lines.push(`  ${entry},`);
      }
      lines.push(`], ${classFields});`);
    }
  }

  lines.push('');

  if (resolvedDefs.length > 0) {
    const names = resolvedDefs.map((dd) => dd.name).join(', ');
    lines.push(`export default { ${names}, merge };`);
  } else {
    lines.push('export default {};');
  }

  lines.push('');
  return lines.join('\n');
}
