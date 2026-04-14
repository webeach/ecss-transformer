import { generateDts, transform, type EcssStylesheet } from '../src';

const SPAN = { line: 1, column: 1, endLine: 1, endColumn: 1 };

function makeButtonAst(): EcssStylesheet {
  return {
    rules: [
      {
        kind: 'state-variant',
        stateVariant: {
          name: 'Theme',
          values: ['light', 'dark'],
          span: SPAN,
        },
      },
      {
        kind: 'state-def',
        stateDef: {
          name: 'Button',
          params: [
            {
              name: '--theme',
              paramType: 'variant',
              variantName: 'Theme',
              defaultValue: 'light',
            },
            {
              name: '--is-disabled',
              paramType: 'boolean',
              defaultValue: 'false',
            },
          ],
          body: [
            {
              kind: 'declaration',
              declaration: {
                property: 'border-radius',
                value: '6px',
                important: false,
                span: SPAN,
              },
            },
            {
              kind: 'if-chain',
              ifChain: {
                ifClause: {
                  condition: { kind: 'var', var: '--is-disabled' },
                  body: [
                    {
                      kind: 'declaration',
                      declaration: {
                        property: 'opacity',
                        value: '0.4',
                        important: false,
                        span: SPAN,
                      },
                    },
                  ],
                  span: SPAN,
                },
                elseIfClauses: [],
                span: SPAN,
              },
            },
            {
              kind: 'if-chain',
              ifChain: {
                ifClause: {
                  condition: {
                    kind: 'comparison',
                    left: '--theme',
                    op: '==',
                    right: { kind: 'string', value: 'light' },
                  },
                  body: [
                    {
                      kind: 'declaration',
                      declaration: {
                        property: 'background',
                        value: '#fff',
                        important: false,
                        span: SPAN,
                      },
                    },
                  ],
                  span: SPAN,
                },
                elseIfClauses: [],
                elseBody: [
                  {
                    kind: 'declaration',
                    declaration: {
                      property: 'background',
                      value: '#1e1e1e',
                      important: false,
                      span: SPAN,
                    },
                  },
                ],
                span: SPAN,
              },
            },
          ],
          span: SPAN,
        },
      },
    ],
  };
}

describe('transform', () => {
  const ast = makeButtonAst();
  const config = {
    filePath: 'test/Button.ecss',
    runtimeImport: '@ecss/transformer/runtime',
  };

  it('generates CSS with base class and data attributes', () => {
    const result = transform(ast, config);
    expect(result.css).toContain('border-radius: 6px;');
    expect(result.css).toMatch(/\.Button-[a-zA-Z0-9_-]+\s*\{/);
    expect(result.css).toMatch(/\[data-e-[a-zA-Z0-9_-]+-is-disabled\]/);
    expect(result.css).toMatch(/\[data-e-[a-zA-Z0-9_-]+-theme="light"\]/);
    expect(result.css).toMatch(/\[data-e-[a-zA-Z0-9_-]+-theme="dark"\]/);
    expect(result.css).toContain('opacity: 0.4;');
    expect(result.css).toContain('background: #fff;');
    expect(result.css).toContain('background: #1e1e1e;');
  });

  it('generates JS with _h() calls', () => {
    const result = transform(ast, config);
    expect(result.js).toContain(
      "import { _h, merge } from '@ecss/transformer/runtime';",
    );
    expect(result.js).toContain("const Button = _h('Button-");
    expect(result.js).toContain("'theme'");
    expect(result.js).toContain("'isDisabled'");
    expect(result.js).toContain("'b', false");
    expect(result.js).toContain("'v', 'light'");
    expect(result.js).toContain('export default { Button, merge };');
  });

  it('generates d.ts with typed interfaces', () => {
    const result = transform(ast, config);
    expect(result.dts).toContain("type Theme = 'light' | 'dark';");
    expect(result.dts).toContain('interface ButtonResult {');
    expect(result.dts).toContain('className: string;');
    expect(result.dts).not.toContain('class: string;');
    expect(result.dts).toContain('interface ButtonParams {');
    expect(result.dts).toContain('theme?: Theme;');
    expect(result.dts).toContain('isDisabled?: boolean;');
    expect(result.dts).toContain('interface EcssStyles {');
    expect(result.dts).toContain('export default styles;');
  });

  it('is deterministic', () => {
    const r1 = transform(ast, config);
    const r2 = transform(ast, config);
    expect(r1.css).toBe(r2.css);
    expect(r1.js).toBe(r2.js);
    expect(r1.dts).toBe(r2.dts);
  });
});

describe('generateDts', () => {
  it('returns only d.ts without css/js', () => {
    const ast = makeButtonAst();
    const dts = generateDts(ast, { filePath: 'test/Button.ecss' });
    expect(dts).toContain("type Theme = 'light' | 'dark';");
    expect(dts).toContain('interface ButtonResult {');
    expect(dts).toContain('export default styles;');
  });
});

describe('no-param state-def', () => {
  it('generates simple class-only output', () => {
    const ast: EcssStylesheet = {
      rules: [
        {
          kind: 'state-def',
          stateDef: {
            name: 'Card',
            params: [],
            body: [
              {
                kind: 'declaration',
                declaration: {
                  property: 'padding',
                  value: '24px',
                  important: false,
                  span: SPAN,
                },
              },
            ],
            span: SPAN,
          },
        },
      ],
    };

    const result = transform(ast, {
      filePath: 'test/Card.ecss',
      runtimeImport: '@ecss/transformer/runtime',
    });

    expect(result.css).toContain('padding: 24px;');
    expect(result.js).toContain("const Card = _h('Card-");
    expect(result.js).toContain('export default { Card, merge };');
    expect(result.dts).toContain('interface CardResult {');
    expect(result.dts).toContain('Card: {');
    expect(result.dts).toContain('(): CardResult;');
  });
});

describe('nested selectors with conditions', () => {
  it('places condition on root element with nested qualified rule', () => {
    const ast: EcssStylesheet = {
      rules: [
        {
          kind: 'state-def',
          stateDef: {
            name: 'Panel',
            params: [
              {
                name: '--active',
                paramType: 'boolean',
                defaultValue: 'false',
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
                          condition: {
                            kind: 'var',
                            var: '--active',
                          },
                          body: [
                            {
                              kind: 'declaration',
                              declaration: {
                                property: 'color',
                                value: 'red',
                                important: false,
                                span: SPAN,
                              },
                            },
                          ],
                          span: SPAN,
                        },
                        elseIfClauses: [],
                        span: SPAN,
                      },
                    },
                  ],
                  span: SPAN,
                },
              },
            ],
            span: SPAN,
          },
        },
      ],
    };

    const result = transform(ast, {
      filePath: 'test/Panel.ecss',
    });

    const hashMatch = result.css.match(/\.Panel-([a-zA-Z0-9_-]+)/);
    expect(hashMatch).toBeTruthy();
    const hash = hashMatch![1];

    expect(result.css).toContain(
      `.Panel-${hash}[data-e-${hash}-active]:hover .child`,
    );
  });
});
