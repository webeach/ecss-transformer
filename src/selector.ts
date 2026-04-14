import { stripDashes } from './naming.js';
import type { ConditionExpr } from './types.js';

/**
 * Converts a condition expression tree into a CSS attribute-selector fragment.
 *
 * The generated selectors target `data-e-<hash>-<param>` attributes that are
 * set on the host element by the JS runtime helper.
 *
 * Mapping rules:
 * - `var`        → `[data-e-<hash>-<param>]`            (attribute present)
 * - `comparison ==` with boolean `true` → `[attr]`      (presence check)
 * - `comparison ==` otherwise → `[attr="value"]`
 * - `comparison !=` → `:not([attr="value"])`
 * - `and`        → concatenated selectors (both must match the same element)
 * - `or`         → `:is(<sel1>, <sel2>, …)`              (see {@link flattenOr})
 *
 * @param expr The condition expression node from the AST.
 * @param hash Short hash segment that scopes the data attributes to this state-def.
 */
export function conditionToSelector(expr: ConditionExpr, hash: string): string {
  switch (expr.kind) {
    case 'var': {
      return `[data-e-${hash}-${stripDashes(expr.var)}]`;
    }
    case 'comparison': {
      const attr = `data-e-${hash}-${stripDashes(expr.left)}`;
      const val = expr.right.value;

      if (expr.op === '!=') {
        return `:not([${attr}="${val}"])`;
      }
      // A boolean `true` comparison is equivalent to a plain presence check.
      if (expr.right.kind === 'boolean' && val === 'true') {
        return `[${attr}]`;
      }
      return `[${attr}="${val}"]`;
    }
    case 'and': {
      // AND = both sub-selectors must hold on the same element → concatenate.
      return (
        conditionToSelector(expr.left, hash) +
        conditionToSelector(expr.right, hash)
      );
    }
    case 'or': {
      // Flatten nested OR nodes before joining to avoid deeply nested :is().
      const parts = flattenOr(expr);
      const inner = parts
        .map((part) => conditionToSelector(part, hash))
        .join(', ');
      return `:is(${inner})`;
    }
  }
}

/**
 * Recursively flattens a left-associative OR expression tree into a flat array.
 *
 * The parser produces OR chains as nested binary nodes; flattening allows
 * `conditionToSelector` to emit a single `:is(a, b, c)` instead of
 * `:is(a, :is(b, c))`.
 */
function flattenOr(expr: ConditionExpr): ConditionExpr[] {
  if (expr.kind === 'or') {
    return [...flattenOr(expr.left), ...flattenOr(expr.right)];
  }
  return [expr];
}

/**
 * Builds the full CSS selector for a rule inside a `@state-def` body.
 *
 * If `selectorContext` contains `&`, each occurrence is replaced with the
 * combined base-class + condition selector (standard CSS nesting semantics).
 * Otherwise the condition selector is prepended and `selectorContext` is
 * appended as a descendant combinator.
 *
 * @param selectorContext The current selector scope (e.g. `"&"`, `"& .icon"`).
 * @param baseClass       The generated CSS class name (without the leading dot).
 * @param conditionSelector The attribute-selector fragment from {@link conditionToSelector}.
 */
export function buildSelector(
  selectorContext: string,
  baseClass: string,
  conditionSelector: string,
): string {
  const replacement = `.${baseClass}${conditionSelector}`;
  if (selectorContext.includes('&')) {
    return selectorContext.replaceAll('&', replacement);
  }
  return `${replacement} ${selectorContext}`;
}
