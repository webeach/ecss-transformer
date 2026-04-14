import type { ConditionExpr } from '../src';
import { buildSelector, conditionToSelector } from '../src/selector';

const HASH = 'abc123';

describe('conditionToSelector', () => {
  it('bare boolean var', () => {
    const expr: ConditionExpr = { kind: 'var', var: '--disabled' };
    expect(conditionToSelector(expr, HASH)).toBe('[data-e-abc123-disabled]');
  });

  it('equality comparison', () => {
    const expr: ConditionExpr = {
      kind: 'comparison',
      left: '--theme',
      op: '==',
      right: { kind: 'string', value: 'dark' },
    };
    expect(conditionToSelector(expr, HASH)).toBe(
      '[data-e-abc123-theme="dark"]',
    );
  });

  it('boolean == true shorthand', () => {
    const expr: ConditionExpr = {
      kind: 'comparison',
      left: '--active',
      op: '==',
      right: { kind: 'boolean', value: 'true' },
    };
    expect(conditionToSelector(expr, HASH)).toBe('[data-e-abc123-active]');
  });

  it('inequality comparison', () => {
    const expr: ConditionExpr = {
      kind: 'comparison',
      left: '--size',
      op: '!=',
      right: { kind: 'string', value: 'sm' },
    };
    expect(conditionToSelector(expr, HASH)).toBe(
      ':not([data-e-abc123-size="sm"])',
    );
  });

  it('AND -> compound selector', () => {
    const expr: ConditionExpr = {
      kind: 'and',
      left: { kind: 'var', var: '--expanded' },
      right: {
        kind: 'comparison',
        left: '--theme',
        op: '==',
        right: { kind: 'string', value: 'dark' },
      },
    };
    expect(conditionToSelector(expr, HASH)).toBe(
      '[data-e-abc123-expanded][data-e-abc123-theme="dark"]',
    );
  });

  it('OR -> :is()', () => {
    const expr: ConditionExpr = {
      kind: 'or',
      left: { kind: 'var', var: '--expanded' },
      right: { kind: 'var', var: '--pinned' },
    };
    expect(conditionToSelector(expr, HASH)).toBe(
      ':is([data-e-abc123-expanded], [data-e-abc123-pinned])',
    );
  });

  it('flattens nested OR', () => {
    const expr: ConditionExpr = {
      kind: 'or',
      left: { kind: 'var', var: '--a' },
      right: {
        kind: 'or',
        left: { kind: 'var', var: '--b' },
        right: { kind: 'var', var: '--c' },
      },
    };
    expect(conditionToSelector(expr, HASH)).toBe(
      ':is([data-e-abc123-a], [data-e-abc123-b], [data-e-abc123-c])',
    );
  });

  it('(A || B) && C -> :is(a, b)[c]', () => {
    const expr: ConditionExpr = {
      kind: 'and',
      left: {
        kind: 'or',
        left: { kind: 'var', var: '--a' },
        right: { kind: 'var', var: '--b' },
      },
      right: { kind: 'var', var: '--c' },
    };
    expect(conditionToSelector(expr, HASH)).toBe(
      ':is([data-e-abc123-a], [data-e-abc123-b])[data-e-abc123-c]',
    );
  });

  it('(A || B) && (C || D) -> :is():is()', () => {
    const expr: ConditionExpr = {
      kind: 'and',
      left: {
        kind: 'or',
        left: { kind: 'var', var: '--a' },
        right: { kind: 'var', var: '--b' },
      },
      right: {
        kind: 'or',
        left: { kind: 'var', var: '--c' },
        right: { kind: 'var', var: '--d' },
      },
    };
    expect(conditionToSelector(expr, HASH)).toBe(
      ':is([data-e-abc123-a], [data-e-abc123-b]):is([data-e-abc123-c], [data-e-abc123-d])',
    );
  });
});

describe('buildSelector', () => {
  it('replaces & with base + conditions', () => {
    const result = buildSelector('&', 'Button-x7k', '[data-e-x7k-disabled]');
    expect(result).toBe('.Button-x7k[data-e-x7k-disabled]');
  });

  it('replaces & in complex selector', () => {
    const result = buildSelector(
      '&:hover .child',
      'Panel-abc',
      '[data-e-abc-active]',
    );
    expect(result).toBe('.Panel-abc[data-e-abc-active]:hover .child');
  });

  it('prepends when no & present', () => {
    const result = buildSelector('span', 'Button-x7k', '');
    expect(result).toBe('.Button-x7k span');
  });

  it('handles empty condition', () => {
    const result = buildSelector('&', 'Card-abc', '');
    expect(result).toBe('.Card-abc');
  });

  it('replaces multiple & occurrences', () => {
    const result = buildSelector('& + &', 'Foo-abc', '[data-e-abc-x]');
    expect(result).toBe('.Foo-abc[data-e-abc-x] + .Foo-abc[data-e-abc-x]');
  });
});
