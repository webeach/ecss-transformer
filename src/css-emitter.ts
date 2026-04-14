import { buildSelector, conditionToSelector } from './selector.js';
import type {
  ConditionExpr,
  CssDeclaration,
  CssRawAtRule,
  EcssStylesheet,
  IfChain,
  ResolvedStateDef,
  StateDefItem,
  VariantMap,
} from './types.js';

// ─── Internal types ───────────────────────────────────────────────────────────

/** A flat CSS rule ready to be serialised. */
interface CssRule {
  selector: string;
  declarations: CssDeclaration[];
}

/**
 * Contextual state threaded through the recursive body-emission functions.
 *
 * - `selectorContext`   — the current CSS selector scope (starts as `"&"`,
 *   updated when entering nested qualified rules).
 * - `conditionSelector` — the accumulated attribute-selector fragment from
 *   enclosing `@if` / `@elseif` clauses; empty string at the top level.
 */
interface EmitContext {
  selectorContext: string;
  conditionSelector: string;
  def: ResolvedStateDef;
  variants: VariantMap;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates plain CSS output from a parsed ECSS stylesheet.
 *
 * The function performs two passes over the AST:
 * 1. Top-level qualified rules and raw at-rules are serialised verbatim.
 * 2. Each resolved `@state-def` body is recursively expanded into flat
 *    `CssRule` objects (handling nested selectors and `@if` chains) and
 *    then formatted.
 *
 * @param ast          Parsed ECSS stylesheet.
 * @param resolvedDefs Pre-resolved state-def descriptors from the transform phase.
 * @param variants     Variant → values lookup map.
 */
export function emitCss(
  ast: EcssStylesheet,
  resolvedDefs: ResolvedStateDef[],
  variants: VariantMap,
): string {
  const chunks: string[] = [];

  // Pass 1: top-level rules that are passed through as-is.
  for (const rule of ast.rules) {
    switch (rule.kind) {
      case 'state-variant':
      case 'state-def':
        // Handled separately — emit nothing at this level.
        break;
      case 'qualified-rule': {
        const qr = rule.qualifiedRule!;
        chunks.push(`${qr.selector} {\n${emitBodyRaw(qr.body)}\n}\n`);
        break;
      }
      case 'at-rule': {
        chunks.push(emitRawAtRule(rule.atRule!));
        break;
      }
    }
  }

  // Pass 2: expand each @state-def into conditioned CSS rules.
  for (const def of resolvedDefs) {
    const ctx: EmitContext = {
      selectorContext: '&',
      conditionSelector: '',
      def,
      variants,
    };
    const rules = emitStateDefBody(def.body, ctx);
    for (const cr of rules) {
      chunks.push(formatRule(cr));
    }
  }

  return chunks.join('\n');
}

// ─── State-def body emission ─────────────────────────────────────────────────

/**
 * Recursively converts a list of state-def body items into flat {@link CssRule}s.
 *
 * Declarations are accumulated in a local buffer and flushed into a single rule
 * whenever the selector context must change (nested rule, `@if` chain, end of list).
 * This preserves declaration order while avoiding duplicate selectors.
 */
function emitStateDefBody(items: StateDefItem[], ctx: EmitContext): CssRule[] {
  const rules: CssRule[] = [];
  const declarations: CssDeclaration[] = [];

  for (const item of items) {
    switch (item.kind) {
      case 'declaration': {
        declarations.push(item.declaration!);
        break;
      }
      case 'qualified-rule': {
        flushDeclarations(declarations, ctx, rules);
        const qr = item.qualifiedRule!;
        const newContext = resolveNestedSelector(
          ctx.selectorContext,
          qr.selector,
        );
        const nested = emitStateDefBody(qr.body, {
          ...ctx,
          selectorContext: newContext,
        });
        rules.push(...nested);
        break;
      }
      case 'if-chain': {
        flushDeclarations(declarations, ctx, rules);
        rules.push(...emitIfChain(item.ifChain!, ctx));
        break;
      }
      case 'at-rule': {
        // Raw at-rules inside @state-def bodies are not yet supported; skip.
        flushDeclarations(declarations, ctx, rules);
        break;
      }
    }
  }

  flushDeclarations(declarations, ctx, rules);
  return rules;
}

/**
 * Emits all pending declarations as a single {@link CssRule} and clears the buffer.
 * No-op when the buffer is empty.
 */
function flushDeclarations(
  declarations: CssDeclaration[],
  ctx: EmitContext,
  rules: CssRule[],
): void {
  if (declarations.length === 0) {
    return;
  }
  const selector = buildSelector(
    ctx.selectorContext,
    ctx.def.className,
    ctx.conditionSelector,
  );
  rules.push({ selector, declarations: [...declarations] });
  declarations.length = 0;
}

// ─── @if chain emission ───────────────────────────────────────────────────────

/**
 * Expands an `@if` / `@elseif` / `@else` chain into a list of {@link CssRule}s.
 *
 * Each branch appends its own condition selector to the parent context.
 * The `@else` branch requires special treatment: instead of a simple negation
 * we try to emit a minimal selector (see {@link resolveElseSelector}).
 */
function emitIfChain(chain: IfChain, ctx: EmitContext): CssRule[] {
  const rules: CssRule[] = [];
  const allClauses = [chain.ifClause, ...chain.elseIfClauses];

  for (const clause of allClauses) {
    const condSel = conditionToSelector(clause.condition, ctx.def.hash);
    const newCtx: EmitContext = {
      ...ctx,
      conditionSelector: ctx.conditionSelector + condSel,
    };
    rules.push(...emitStateDefBody(clause.body, newCtx));
  }

  if (chain.elseBody) {
    const elseSel = resolveElseSelector(
      allClauses.map((cl) => cl.condition),
      ctx,
    );
    if (elseSel) {
      const newCtx: EmitContext = {
        ...ctx,
        conditionSelector: ctx.conditionSelector + elseSel,
      };
      rules.push(...emitStateDefBody(chain.elseBody, newCtx));
    }
  }

  return rules;
}

/**
 * Produces the CSS selector fragment for an `@else` branch.
 *
 * **Optimisation:** when all preceding branches compare the same variant
 * parameter against different values, the `@else` covers the remaining values.
 * In that case we emit a precise `[attr="remaining"]` or `:is(…)` selector
 * instead of chaining `:not()` for each covered branch.
 *
 * **Fallback:** for all other condition shapes, each covered condition is
 * wrapped in `:not(…)` and concatenated.
 */
function resolveElseSelector(
  previousConditions: ConditionExpr[],
  ctx: EmitContext,
): string | null {
  const singleVariant = extractSingleVariantChain(previousConditions);

  if (singleVariant) {
    const { paramName, coveredValues } = singleVariant;
    const param = ctx.def.params.find((pr) => pr.originalName === paramName);

    if (param?.variantValues) {
      const remaining = param.variantValues.filter(
        (vv) => !coveredValues.includes(vv),
      );
      const bare = paramName.replace(/^--/, '');

      if (remaining.length === 1) {
        return `[data-e-${ctx.def.hash}-${bare}="${remaining[0]}"]`;
      }
      if (remaining.length > 1) {
        const inner = remaining
          .map((vv) => `[data-e-${ctx.def.hash}-${bare}="${vv}"]`)
          .join(', ');
        return `:is(${inner})`;
      }
    }
  }

  // Fallback: negate every covered condition.
  return previousConditions
    .map((cond) => `:not(${conditionToSelector(cond, ctx.def.hash)})`)
    .join('');
}

// ─── Single-variant chain detection ──────────────────────────────────────────

interface SingleVariantChain {
  paramName: string;
  coveredValues: string[];
}

/**
 * Checks whether all conditions are equality comparisons on the same parameter.
 *
 * Returns `null` if the chain mixes parameters or uses non-equality operators,
 * in which case the generic `:not()` fallback is used by the caller.
 */
function extractSingleVariantChain(
  conditions: ConditionExpr[],
): SingleVariantChain | null {
  let paramName: string | null = null;
  const coveredValues: string[] = [];

  for (const cond of conditions) {
    if (cond.kind !== 'comparison' || cond.op !== '==') {
      return null;
    }
    if (paramName === null) {
      paramName = cond.left;
    } else if (cond.left !== paramName) {
      return null;
    }
    coveredValues.push(cond.right.value);
  }

  return paramName ? { paramName, coveredValues } : null;
}

// ─── Nested selector resolution ───────────────────────────────────────────────

/**
 * Resolves a nested selector relative to the current selector context.
 *
 * Follows CSS nesting semantics: if `nestedSelector` contains `&`, each
 * occurrence is replaced with `currentContext`; otherwise `nestedSelector`
 * is appended as a descendant.
 */
function resolveNestedSelector(
  currentContext: string,
  nestedSelector: string,
): string {
  if (nestedSelector.includes('&')) {
    return nestedSelector.replaceAll('&', currentContext);
  }
  return `${currentContext} ${nestedSelector}`;
}

// ─── Serialisation helpers ────────────────────────────────────────────────────

/** Serialises a flat {@link CssRule} to a CSS rule block string. */
function formatRule(rule: CssRule): string {
  const decls = rule.declarations
    .map(
      (dc) =>
        `  ${dc.property}: ${dc.value}${dc.important ? ' !important' : ''};`,
    )
    .join('\n');
  return `${rule.selector} {\n${decls}\n}\n`;
}

/**
 * Serialises a list of state-def body items into raw declaration lines.
 * Used for top-level qualified rules that contain no ECSS-specific constructs.
 */
function emitBodyRaw(items: StateDefItem[]): string {
  const lines: string[] = [];
  for (const item of items) {
    if (item.kind === 'declaration') {
      const dc = item.declaration!;
      lines.push(
        `  ${dc.property}: ${dc.value}${dc.important ? ' !important' : ''};`,
      );
    }
  }
  return lines.join('\n');
}

/** Serialises a raw at-rule that the transformer passes through verbatim. */
function emitRawAtRule(rule: CssRawAtRule): string {
  if (rule.block) {
    return `@${rule.name} ${rule.prelude} ${rule.block}\n`;
  }
  return `@${rule.name} ${rule.prelude};\n`;
}
