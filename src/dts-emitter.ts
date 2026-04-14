import type { ClassAttribute, ResolvedStateDef, VariantMap } from './types.js';

/**
 * Generates the TypeScript declaration (`.d.ts`) source for all resolved
 * `@state-def` entries.
 *
 * The emitted declarations include:
 * - A string-union `type` for each `@state-variant` that is actually referenced
 *   by at least one parameter (unused variants are omitted).
 * - A `<Name>Result` interface describing the object returned by a state function
 *   (class attribute + data attributes for each parameter).
 * - A `<Name>Params` interface for state-defs that have parameters, used as the
 *   alternative object-argument overload.
 * - An `EcssStyles` interface with a call-signature for each state-def, plus the
 *   `merge` helper.
 * - A `declare const styles: EcssStyles` and a default export.
 *
 * @param resolvedDefs   List of resolved state-def descriptors.
 * @param variants       Variant → values lookup map (from `@state-variant` rules).
 * @param classAttribute Which class field(s) to declare in result interfaces.
 */
export function emitDts(
  resolvedDefs: ResolvedStateDef[],
  variants: VariantMap,
  classAttribute: ClassAttribute = 'className',
): string {
  const lines: string[] = [];

  // Collect only the variant names actually used by resolved params to avoid
  // emitting dead type aliases.
  const usedVariants = new Set<string>();
  for (const def of resolvedDefs) {
    for (const pr of def.params) {
      if (pr.variantName) {
        usedVariants.add(pr.variantName);
      }
    }
  }

  for (const variantName of usedVariants) {
    const values = variants[variantName];
    if (values) {
      const union = values.map((vv) => `'${vv}'`).join(' | ');
      lines.push(`type ${variantName} = ${union};`);
    }
  }

  if (usedVariants.size > 0) {
    lines.push('');
  }

  for (const def of resolvedDefs) {
    lines.push(...emitResultInterface(def, classAttribute));
    lines.push('');

    if (def.params.length > 0) {
      lines.push(...emitParamsInterface(def));
      lines.push('');
    }
  }

  // The top-level EcssStyles interface groups all state functions and the merge helper.
  lines.push('interface EcssStyles {');
  for (const def of resolvedDefs) {
    lines.push(...emitFunctionType(def));
  }
  lines.push(
    '  merge: (...results: Record<string, string | undefined>[]) => Record<string, string | undefined>;',
  );
  lines.push('}');
  lines.push('');
  lines.push('declare const styles: EcssStyles;');
  lines.push('export default styles;');
  lines.push('');

  return lines.join('\n');
}

// ─── Per-def emitters ─────────────────────────────────────────────────────────

/**
 * Emits the `<Name>Result` interface — the shape of the object returned by a
 * state function call.
 *
 * The result always contains the class attribute(s) plus one data-attribute
 * entry per parameter. Boolean params are optional (`?: ''`) because they are
 * omitted from the result when `false`.
 */
function emitResultInterface(
  def: ResolvedStateDef,
  classAttribute: ClassAttribute,
): string[] {
  const lines: string[] = [];
  lines.push(`interface ${def.name}Result {`);

  if (classAttribute === 'class' || classAttribute === 'both') {
    lines.push('  class: string;');
  }
  if (classAttribute === 'className' || classAttribute === 'both') {
    lines.push('  className: string;');
  }

  for (const pr of def.params) {
    if (pr.type === 'boolean') {
      // Absent from the result object when the flag is false → optional.
      lines.push(`  '${pr.attrName}'?: '';`);
    } else {
      lines.push(`  '${pr.attrName}': string;`);
    }
  }

  lines.push('}');
  return lines;
}

/**
 * Emits the `<Name>Params` interface — the named-object argument alternative
 * for state functions with one or more parameters.
 */
function emitParamsInterface(def: ResolvedStateDef): string[] {
  const lines: string[] = [];
  lines.push(`interface ${def.name}Params {`);

  for (const pr of def.params) {
    const tsType = pr.variantName ?? 'boolean';
    lines.push(`  ${pr.camelName}?: ${tsType};`);
  }

  lines.push('}');
  return lines;
}

/**
 * Emits the call-signature block for a state function inside `EcssStyles`.
 *
 * State functions with parameters support two equivalent call forms via
 * TypeScript overloads:
 * - Positional: `button(isActive?, size?)` — matches the order of `@state-def` params.
 * - Named-object: `button({ isActive?, size? })` — mirrors the `<Name>Params` interface.
 *
 * State functions with no parameters only expose the no-argument form.
 */
function emitFunctionType(def: ResolvedStateDef): string[] {
  const lines: string[] = [];

  if (def.params.length === 0) {
    lines.push(`  ${def.name}: {`);
    lines.push(`    (): ${def.name}Result;`);
    lines.push('  };');
    return lines;
  }

  const positionalArgs = def.params
    .map((pr) => {
      const tsType = pr.variantName ?? 'boolean';
      return `${pr.camelName}?: ${tsType}`;
    })
    .join(', ');

  lines.push(`  ${def.name}: {`);
  lines.push(`    (${positionalArgs}): ${def.name}Result;`);
  lines.push(`    (params: ${def.name}Params): ${def.name}Result;`);
  lines.push('  };');

  return lines;
}
