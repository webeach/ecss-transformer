import { emitCss } from './css-emitter.js';
import { emitDts } from './dts-emitter.js';
import { applyTemplate, computeHash } from './hash.js';
import { emitJs } from './js-emitter.js';
import { kebabToCamel, paramToAttr, stripDashes } from './naming.js';
import type {
  DtsConfig,
  EcssStylesheet,
  ResolvedParam,
  ResolvedStateDef,
  TransformConfig,
  TransformResult,
  VariantMap,
} from './types.js';

/**
 * Transforms an ECSS AST into all three output artifacts: CSS, JS and `.d.ts`.
 *
 * The pipeline is:
 * 1. Collect `@state-variant` declarations into a lookup map.
 * 2. Resolve every `@state-def` into a {@link ResolvedStateDef} (class name,
 *    hash, typed parameters).
 * 3. Emit each artifact independently via the dedicated emitters.
 *
 * @param ast    Parsed ECSS stylesheet returned by `@ecss/parser`.
 * @param config Transform options (file path, runtime import, class attribute).
 */
export function transform(
  ast: EcssStylesheet,
  config: TransformConfig,
): TransformResult {
  const variants = collectVariants(ast);
  const resolvedDefs = resolveStateDefs(ast, variants, config);

  const css = emitCss(ast, resolvedDefs, variants);
  const js = emitJs(resolvedDefs, config.runtimeImport, config.classAttribute);
  const dts = emitDts(resolvedDefs, variants, config.classAttribute);

  return { css, js, dts };
}

/**
 * Generates only the `.d.ts` declaration string for an ECSS AST.
 *
 * Useful when the build plugin needs to produce a sidecar `.ecss.d.ts` file
 * for IDE support without re-running the full transform.
 *
 * @param ast    Parsed ECSS stylesheet.
 * @param config Options (file path and optional class attribute).
 */
export function generateDts(ast: EcssStylesheet, config: DtsConfig): string {
  const variants = collectVariants(ast);
  const resolvedDefs = resolveStateDefs(ast, variants, config);
  return emitDts(resolvedDefs, variants, config.classAttribute);
}

// ─── Resolve phase ────────────────────────────────────────────────────────────

/**
 * Collects all `@state-variant` rules into a name → values lookup map.
 * Variants defined earlier in the file take precedence if names collide.
 */
function collectVariants(ast: EcssStylesheet): VariantMap {
  const variants: VariantMap = {};
  for (const rule of ast.rules) {
    if (rule.kind === 'state-variant' && rule.stateVariant) {
      variants[rule.stateVariant.name] = rule.stateVariant.values;
    }
  }
  return variants;
}

/**
 * Resolves all `@state-def` rules into {@link ResolvedStateDef} objects.
 *
 * For each state-def:
 * - Computes a SHA-256 hash of `filePath + defName` for stable scoping.
 * - Applies the class-name template to produce the final CSS class.
 * - Extracts the short hash segment from the class name (see {@link extractHash}).
 * - Maps each raw parameter to a {@link ResolvedParam} with camelCase name,
 *   data attribute name, typed default value and variant metadata.
 */
function resolveStateDefs(
  ast: EcssStylesheet,
  variants: VariantMap,
  config: DtsConfig,
): ResolvedStateDef[] {
  const defs: ResolvedStateDef[] = [];

  for (const rule of ast.rules) {
    if (rule.kind !== 'state-def' || !rule.stateDef) {
      continue;
    }

    const sd = rule.stateDef;
    const hash = computeHash(config.filePath, sd.name);
    const className = applyTemplate(config.classTemplate, sd.name, hash);
    const shortHash = extractHash(className, sd.name);

    const params: ResolvedParam[] = sd.params.map((pr) => {
      const bare = stripDashes(pr.name);
      const camelName = kebabToCamel(bare);
      const attrName = paramToAttr(shortHash, pr.name);

      // Normalise the raw string default value to a typed JS value.
      let defaultValue: string | boolean | undefined;
      if (pr.paramType === 'boolean') {
        defaultValue = pr.defaultValue === 'true';
      } else {
        defaultValue = pr.defaultValue;
      }

      return {
        originalName: pr.name,
        camelName,
        attrName,
        type: pr.paramType,
        variantName: pr.variantName,
        variantValues: pr.variantName ? variants[pr.variantName] : undefined,
        defaultValue,
      };
    });

    defs.push({
      name: sd.name,
      className,
      hash: shortHash,
      params,
      body: sd.body,
    });
  }

  return defs;
}

/**
 * Extracts the short hash segment that was embedded inside a generated class name.
 *
 * The class name is produced by {@link applyTemplate} and may look like
 * `"button-a1b2c3"`. To avoid duplicating the template-parsing logic this
 * function works in reverse: it finds the state-def `name` inside `className`,
 * then grabs the next alphanumeric token after any separators (e.g. `-`).
 *
 * Edge case: if `name` is not found in `className` (e.g. a custom template
 * that omits `[name]`), `className` itself is returned as a fallback so that
 * data-attribute scoping still produces unique names.
 *
 * @param className The fully-generated class name string.
 * @param name      The original state-def identifier.
 */
function extractHash(className: string, name: string): string {
  const idx = className.indexOf(name);
  if (idx === -1) {
    // Custom template without [name] token — use the whole class name as the scope key.
    return className;
  }

  const after = className.slice(idx + name.length);
  // Skip any non-alphanumeric separators and capture the next token.
  const match = after.match(/^[^a-zA-Z0-9]*([a-zA-Z0-9_-]+)/);
  return match ? match[1] : className;
}
