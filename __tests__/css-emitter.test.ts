import { emitCss } from '../src/css-emitter.js';
import type {
  EcssStylesheet,
  ResolvedStateDef,
  VariantMap,
} from '../src/types.js';

function makeDef(overrides: Partial<ResolvedStateDef>): ResolvedStateDef {
  return {
    name: 'Test',
    className: 'Test-abc123',
    hash: 'abc123',
    params: [],
    body: [],
    ...overrides,
  };
}

const EMPTY_AST: EcssStylesheet = { rules: [] };

describe('emitCss', () => {
  it('emits base class with unconditional declarations', () => {
    const def = makeDef({
      body: [
        {
          kind: 'declaration',
          declaration: {
            property: 'border-radius',
            value: '6px',
            important: false,
            span: { line: 1, column: 1, endLine: 1, endColumn: 1 },
          },
        },
        {
          kind: 'declaration',
          declaration: {
            property: 'color',
            value: 'red',
            important: true,
            span: { line: 1, column: 1, endLine: 1, endColumn: 1 },
          },
        },
      ],
    });

    const css = emitCss(EMPTY_AST, [def], {});
    expect(css).toContain('.Test-abc123 {');
    expect(css).toContain('  border-radius: 6px;');
    expect(css).toContain('  color: red !important;');
  });

  it('emits conditional selector for @if boolean', () => {
    const def = makeDef({
      params: [
        {
          originalName: '--disabled',
          camelName: 'disabled',
          attrName: 'data-e-abc123-disabled',
          type: 'boolean',
          defaultValue: false,
        },
      ],
      body: [
        {
          kind: 'if-chain',
          ifChain: {
            ifClause: {
              condition: { kind: 'var', var: '--disabled' },
              body: [
                {
                  kind: 'declaration',
                  declaration: {
                    property: 'opacity',
                    value: '0.4',
                    important: false,
                    span: {
                      line: 1,
                      column: 1,
                      endLine: 1,
                      endColumn: 1,
                    },
                  },
                },
              ],
              span: { line: 1, column: 1, endLine: 1, endColumn: 1 },
            },
            elseIfClauses: [],
            span: { line: 1, column: 1, endLine: 1, endColumn: 1 },
          },
        },
      ],
    });

    const css = emitCss(EMPTY_AST, [def], {});
    expect(css).toContain('.Test-abc123[data-e-abc123-disabled]');
    expect(css).toContain('opacity: 0.4');
  });

  it('emits @else with remaining variant values', () => {
    const variants: VariantMap = {
      Size: ['sm', 'md', 'lg'],
    };

    const def = makeDef({
      params: [
        {
          originalName: '--size',
          camelName: 'size',
          attrName: 'data-e-abc123-size',
          type: 'variant',
          variantName: 'Size',
          variantValues: ['sm', 'md', 'lg'],
          defaultValue: 'md',
        },
      ],
      body: [
        {
          kind: 'if-chain',
          ifChain: {
            ifClause: {
              condition: {
                kind: 'comparison',
                left: '--size',
                op: '==',
                right: { kind: 'string', value: 'sm' },
              },
              body: [
                {
                  kind: 'declaration',
                  declaration: {
                    property: 'padding',
                    value: '4px',
                    important: false,
                    span: {
                      line: 1,
                      column: 1,
                      endLine: 1,
                      endColumn: 1,
                    },
                  },
                },
              ],
              span: { line: 1, column: 1, endLine: 1, endColumn: 1 },
            },
            elseIfClauses: [
              {
                condition: {
                  kind: 'comparison',
                  left: '--size',
                  op: '==',
                  right: { kind: 'string', value: 'md' },
                },
                body: [
                  {
                    kind: 'declaration',
                    declaration: {
                      property: 'padding',
                      value: '8px',
                      important: false,
                      span: {
                        line: 1,
                        column: 1,
                        endLine: 1,
                        endColumn: 1,
                      },
                    },
                  },
                ],
                span: {
                  line: 1,
                  column: 1,
                  endLine: 1,
                  endColumn: 1,
                },
              },
            ],
            elseBody: [
              {
                kind: 'declaration',
                declaration: {
                  property: 'padding',
                  value: '12px',
                  important: false,
                  span: {
                    line: 1,
                    column: 1,
                    endLine: 1,
                    endColumn: 1,
                  },
                },
              },
            ],
            span: { line: 1, column: 1, endLine: 1, endColumn: 1 },
          },
        },
      ],
    });

    const css = emitCss(EMPTY_AST, [def], variants);
    expect(css).toContain('[data-e-abc123-size="sm"]');
    expect(css).toContain('[data-e-abc123-size="md"]');
    expect(css).toContain('[data-e-abc123-size="lg"]');
  });

  it('emits nested selectors correctly', () => {
    const def = makeDef({
      params: [
        {
          originalName: '--active',
          camelName: 'active',
          attrName: 'data-e-abc123-active',
          type: 'boolean',
          defaultValue: false,
        },
      ],
      body: [
        {
          kind: 'if-chain',
          ifChain: {
            ifClause: {
              condition: { kind: 'var', var: '--active' },
              body: [
                {
                  kind: 'qualified-rule',
                  qualifiedRule: {
                    selector: '& > span',
                    body: [
                      {
                        kind: 'declaration',
                        declaration: {
                          property: 'color',
                          value: 'red',
                          important: false,
                          span: {
                            line: 1,
                            column: 1,
                            endLine: 1,
                            endColumn: 1,
                          },
                        },
                      },
                    ],
                    span: {
                      line: 1,
                      column: 1,
                      endLine: 1,
                      endColumn: 1,
                    },
                  },
                },
              ],
              span: { line: 1, column: 1, endLine: 1, endColumn: 1 },
            },
            elseIfClauses: [],
            span: { line: 1, column: 1, endLine: 1, endColumn: 1 },
          },
        },
      ],
    });

    const css = emitCss(EMPTY_AST, [def], {});
    expect(css).toContain('.Test-abc123[data-e-abc123-active] > span');
  });

  it('handles qualified rule then nested @if', () => {
    const def = makeDef({
      params: [
        {
          originalName: '--active',
          camelName: 'active',
          attrName: 'data-e-abc123-active',
          type: 'boolean',
          defaultValue: false,
        },
      ],
      body: [
        {
          kind: 'qualified-rule',
          qualifiedRule: {
            selector: '&:hover .child',
            body: [
              {
                kind: 'if-chain',
                ifChain: {
                  ifClause: {
                    condition: { kind: 'var', var: '--active' },
                    body: [
                      {
                        kind: 'declaration',
                        declaration: {
                          property: 'color',
                          value: 'red',
                          important: false,
                          span: {
                            line: 1,
                            column: 1,
                            endLine: 1,
                            endColumn: 1,
                          },
                        },
                      },
                    ],
                    span: {
                      line: 1,
                      column: 1,
                      endLine: 1,
                      endColumn: 1,
                    },
                  },
                  elseIfClauses: [],
                  span: {
                    line: 1,
                    column: 1,
                    endLine: 1,
                    endColumn: 1,
                  },
                },
              },
            ],
            span: { line: 1, column: 1, endLine: 1, endColumn: 1 },
          },
        },
      ],
    });

    const css = emitCss(EMPTY_AST, [def], {});
    expect(css).toContain('.Test-abc123[data-e-abc123-active]:hover .child');
  });

  it('passes through regular CSS rules', () => {
    const ast: EcssStylesheet = {
      rules: [
        {
          kind: 'qualified-rule',
          qualifiedRule: {
            selector: '*, *::before, *::after',
            body: [
              {
                kind: 'declaration',
                declaration: {
                  property: 'box-sizing',
                  value: 'border-box',
                  important: false,
                  span: {
                    line: 1,
                    column: 1,
                    endLine: 1,
                    endColumn: 1,
                  },
                },
              },
            ],
            span: { line: 1, column: 1, endLine: 1, endColumn: 1 },
          },
        },
      ],
    };

    const css = emitCss(ast, [], {});
    expect(css).toContain('*, *::before, *::after {');
    expect(css).toContain('box-sizing: border-box;');
  });
});
