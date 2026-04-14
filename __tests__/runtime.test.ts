import { _h, merge } from '../src/runtime';

describe('_h', () => {
  it('returns className only by default', () => {
    const Card = _h('Card-abc', []);
    expect(Card()).toEqual({ className: 'Card-abc' });
  });

  it('returns class only when classFields is ["class"]', () => {
    const Card = _h('Card-abc', [], ['class']);
    expect(Card()).toEqual({ class: 'Card-abc' });
  });

  it('returns both class and className when classFields is ["class","className"]', () => {
    const Card = _h('Card-abc', [], ['class', 'className']);
    expect(Card()).toEqual({ class: 'Card-abc', className: 'Card-abc' });
  });

  it('handles boolean param positionally', () => {
    const Foo = _h('Foo-abc', [
      ['isActive', 'data-e-abc-is-active', 'b', false],
    ]);

    expect(Foo(true)).toEqual({
      className: 'Foo-abc',
      'data-e-abc-is-active': '',
    });

    expect(Foo(false)).toEqual({
      className: 'Foo-abc',
      'data-e-abc-is-active': undefined,
    });
  });

  it('handles variant param positionally', () => {
    const Btn = _h('Btn-abc', [['theme', 'data-e-abc-theme', 'v', 'light']]);

    expect(Btn('dark')).toEqual({
      className: 'Btn-abc',
      'data-e-abc-theme': 'dark',
    });
  });

  it('applies defaults when called with no args', () => {
    const Btn = _h('Btn-abc', [
      ['theme', 'data-e-abc-theme', 'v', 'light'],
      ['isDisabled', 'data-e-abc-is-disabled', 'b', false],
    ]);

    expect(Btn()).toEqual({
      className: 'Btn-abc',
      'data-e-abc-theme': 'light',
      'data-e-abc-is-disabled': undefined,
    });
  });

  it('handles object-style params', () => {
    const Btn = _h('Btn-abc', [
      ['theme', 'data-e-abc-theme', 'v', 'light'],
      ['isDisabled', 'data-e-abc-is-disabled', 'b', false],
    ]);

    expect(Btn({ theme: 'dark', isDisabled: true })).toEqual({
      className: 'Btn-abc',
      'data-e-abc-theme': 'dark',
      'data-e-abc-is-disabled': '',
    });
  });

  it('applies defaults for missing object keys', () => {
    const Btn = _h('Btn-abc', [
      ['theme', 'data-e-abc-theme', 'v', 'light'],
      ['isDisabled', 'data-e-abc-is-disabled', 'b', false],
    ]);

    expect(Btn({ isDisabled: true })).toEqual({
      className: 'Btn-abc',
      'data-e-abc-theme': 'light',
      'data-e-abc-is-disabled': '',
    });
  });
});

describe('merge', () => {
  it('concatenates className', () => {
    const result = merge({ className: 'A-abc' }, { className: 'B-def' });
    expect(result.className).toBe('A-abc B-def');
  });

  it('concatenates class when using class mode', () => {
    const result = merge({ class: 'A-abc' }, { class: 'B-def' });
    expect(result.class).toBe('A-abc B-def');
  });

  it('merges data attributes', () => {
    const result = merge(
      {
        className: 'A-abc',
        'data-e-abc-x': '',
      },
      {
        className: 'B-def',
        'data-e-def-y': 'dark',
      },
    );
    expect(result['data-e-abc-x']).toBe('');
    expect(result['data-e-def-y']).toBe('dark');
  });

  it('skips undefined data attributes', () => {
    const result = merge(
      { className: 'A', 'data-e-abc-x': undefined },
      { className: 'B' },
    );
    expect(result).not.toHaveProperty('data-e-abc-x');
  });
});
