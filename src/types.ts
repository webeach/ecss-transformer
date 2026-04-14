// ─── Public config & result types ────────────────────────────────────────────

/** Shared base options required by all transformer entry points. */
export interface BaseConfig {
  /**
   * Template that controls the generated CSS class name.
   * Supports `[name]` and `[hash:N]` tokens.
   * @default "[name]-[hash:6]"
   */
  classTemplate?: string;
  /** Absolute or project-relative path to the `.ecss` source file. Used for hashing. */
  filePath: string;
}

/**
 * Which HTML attribute(s) the state function result should include.
 * - `'className'` — React (default)
 * - `'class'`     — Vue templates, Svelte, Solid
 * - `'both'`      — both `class` and `className` in the same result object
 */
export type ClassAttribute = 'className' | 'class' | 'both';

/** Options for the main {@link transform} function. */
export interface TransformConfig extends BaseConfig {
  /**
   * Which class attribute(s) to include in the result object.
   * @default "className"
   */
  classAttribute?: ClassAttribute;
  /**
   * Module specifier for the runtime import.
   * @default "virtual:ecss/runtime"
   */
  runtimeImport?: string;
}

/** Options for standalone `.d.ts` generation via {@link generateDts}. */
export interface DtsConfig extends BaseConfig {
  /** @default "className" */
  classAttribute?: ClassAttribute;
}

/** The three output artifacts produced by {@link transform}. */
export interface TransformResult {
  /** Plain CSS output with all state-conditional selectors expanded. */
  css: string;
  /** TypeScript declaration file (`.d.ts`) for the helper object. */
  dts: string;
  /** ES module JS that exports a typed helper object. */
  js: string;
}

// ─── AST types (mirroring @ecss/parser napi output) ──────────────────────────

/** Source location of an AST node, 1-based lines and 0-based columns. */
export interface Span {
  /** 0-based start column. */
  column: number;
  /** 0-based end column (exclusive). */
  endColumn: number;
  /** 1-based end line (inclusive). */
  endLine: number;
  /** 1-based start line. */
  line: number;
}

/** Root node returned by the parser. */
export interface EcssStylesheet {
  /** All top-level rules in document order. */
  rules: EcssRule[];
}

/** A single top-level rule in an ECSS stylesheet. */
export interface EcssRule {
  /** Present when `kind === 'at-rule'`. */
  atRule?: CssRawAtRule;
  /** Discriminant tag identifying the rule variant. */
  kind: 'state-variant' | 'state-def' | 'qualified-rule' | 'at-rule';
  /** Present when `kind === 'qualified-rule'`. */
  qualifiedRule?: CssQualifiedRule;
  /** Present when `kind === 'state-def'`. */
  stateDef?: StateDef;
  /** Present when `kind === 'state-variant'`. */
  stateVariant?: StateVariant;
}

/** `@state-variant` declaration — defines a named set of allowed string values. */
export interface StateVariant {
  /** Identifier used to reference this variant from `@state-def` parameters. */
  name: string;
  /** Source location of the entire `@state-variant` rule. */
  span: Span;
  /** Ordered list of allowed string values for this variant. */
  values: string[];
}

/** `@state-def` block — defines a stateful component class with typed parameters. */
export interface StateDef {
  /** Items inside the `@state-def` block body. */
  body: StateDefItem[];
  /** Identifier used as the JS export name and as the base for the generated class. */
  name: string;
  /** Parameters declared in the `@state-def` header. */
  params: StateParam[];
  /** Source location of the entire `@state-def` rule. */
  span: Span;
}

/** A single parameter declared in a `@state-def` header. */
export interface StateParam {
  /** Optional default value as a raw string (e.g. `'true'`, `'lg'`). */
  defaultValue?: string;
  /** Raw parameter name including the `--` prefix (e.g. `--is-active`). */
  name: string;
  /** `'boolean'` — toggled presence; `'variant'` — one of a named variant's values. */
  paramType: 'boolean' | 'variant';
  /** For `paramType === 'variant'`: the referenced `@state-variant` name. */
  variantName?: string;
}

/** A single item inside a `@state-def` body or a nested qualified rule. */
export interface StateDefItem {
  /** Present when `kind === 'at-rule'`. */
  atRule?: CssRawAtRule;
  /** Present when `kind === 'declaration'`. */
  declaration?: CssDeclaration;
  /** Present when `kind === 'if-chain'`. */
  ifChain?: IfChain;
  /** Discriminant tag identifying the item variant. */
  kind: 'declaration' | 'qualified-rule' | 'if-chain' | 'at-rule';
  /** Present when `kind === 'qualified-rule'`. */
  qualifiedRule?: CssQualifiedRule;
}

/** A CSS property–value pair. */
export interface CssDeclaration {
  /** Whether the declaration has `!important`. */
  important: boolean;
  /** CSS property name (e.g. `color`, `--custom-prop`). */
  property: string;
  /** Source location of the declaration. */
  span: Span;
  /** Raw CSS value string (e.g. `red`, `1px solid`). */
  value: string;
}

/** A CSS qualified rule (selector + body). */
export interface CssQualifiedRule {
  /** Items inside the rule block. */
  body: StateDefItem[];
  /** Raw selector string as written in the source. */
  selector: string;
  /** Source location of the entire rule. */
  span: Span;
}

/** A raw at-rule that the transformer passes through verbatim. */
export interface CssRawAtRule {
  /** Present for block at-rules (`@media`, `@supports`, …), absent for statement at-rules. */
  block?: string;
  /** At-rule name without the `@` sigil (e.g. `media`, `keyframes`). */
  name: string;
  /** Everything between the at-rule name and the block or semicolon. */
  prelude: string;
  /** Source location of the entire at-rule. */
  span: Span;
}

/** An `@if` / `@elseif` / `@else` chain inside a `@state-def`. */
export interface IfChain {
  /** Body of the `@else` branch, if present. */
  elseBody?: StateDefItem[];
  /** Zero or more `@elseif` branches in source order. */
  elseIfClauses: IfClause[];
  /** The leading `@if` branch. */
  ifClause: IfClause;
  /** Source location of the entire if-chain. */
  span: Span;
}

/** A single `@if` or `@elseif` branch. */
export interface IfClause {
  /** Items to emit when the condition holds. */
  body: StateDefItem[];
  /** Boolean condition expression that guards this branch. */
  condition: ConditionExpr;
  /** Source location of this clause. */
  span: Span;
}

// ─── Condition expression (JSON shape produced by the parser) ─────────────────

/**
 * A boolean expression tree used in `@if` / `@elseif` conditions.
 *
 * - `var`        — parameter is truthy: `--active`
 * - `comparison` — equality / inequality: `--size == 'lg'`
 * - `and`        — logical AND of two sub-expressions
 * - `or`         — logical OR  of two sub-expressions
 */
export type ConditionExpr =
  | { kind: 'var'; var: string }
  | { kind: 'comparison'; left: string; op: '==' | '!='; right: ConditionValue }
  | { kind: 'and'; left: ConditionExpr; right: ConditionExpr }
  | { kind: 'or'; left: ConditionExpr; right: ConditionExpr };

/** The right-hand side of a comparison condition. */
export interface ConditionValue {
  /** Syntactic category of the literal: a quoted string, a bare boolean, or an identifier. */
  kind: 'string' | 'boolean' | 'ident';
  /** Raw string representation of the value as written in the source. */
  value: string;
}

// ─── Internal types used across emitters ─────────────────────────────────────

/**
 * A fully-resolved `@state-def` ready for code generation.
 * Produced by the resolve phase in `transform.ts` and consumed by all emitters.
 */
export interface ResolvedStateDef {
  /** Items from the original `@state-def` body, passed through to the CSS emitter. */
  body: StateDefItem[];
  /** Generated CSS class name (after applying the class template). */
  className: string;
  /**
   * Short hash segment extracted from `className`.
   * Used to build `data-e-<hash>-<param>` data attributes.
   */
  hash: string;
  /** Original identifier from the ECSS source. */
  name: string;
  /** Resolved parameter descriptors in declaration order. */
  params: ResolvedParam[];
}

/** A fully-resolved parameter of a `@state-def`. */
export interface ResolvedParam {
  /** Data attribute name set on the host element (e.g. `data-e-abc123-is-active`). */
  attrName: string;
  /** camelCase JS property name (e.g. `isActive`). */
  camelName: string;
  /** Typed default value applied when the caller omits the argument. */
  defaultValue: string | boolean | undefined;
  /** Raw parameter name as written in ECSS (e.g. `--is-active`). */
  originalName: string;
  /** `'boolean'` — presence flag; `'variant'` — one of a fixed set of string values. */
  type: 'boolean' | 'variant';
  /** For variant params: the referenced `@state-variant` name. */
  variantName?: string;
  /** For variant params: the allowed string values from the referenced variant. */
  variantValues?: string[];
}

/** Map from `@state-variant` name to its list of allowed values. */
export interface VariantMap {
  [name: string]: string[];
}
