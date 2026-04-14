import { kebabToCamel, paramToAttr, stripDashes } from '../src/naming.js';

describe('stripDashes', () => {
  it('removes leading --', () => {
    expect(stripDashes('--is-active')).toBe('is-active');
  });

  it('leaves names without -- unchanged', () => {
    expect(stripDashes('foo')).toBe('foo');
  });
});

describe('kebabToCamel', () => {
  it('converts kebab-case to camelCase', () => {
    expect(kebabToCamel('is-active')).toBe('isActive');
  });

  it('handles multiple dashes', () => {
    expect(kebabToCamel('my-long-name')).toBe('myLongName');
  });

  it('leaves single word unchanged', () => {
    expect(kebabToCamel('disabled')).toBe('disabled');
  });
});

describe('paramToAttr', () => {
  it('builds data attribute name', () => {
    expect(paramToAttr('x7k2m9', '--is-active')).toBe(
      'data-e-x7k2m9-is-active',
    );
  });

  it('works with simple names', () => {
    expect(paramToAttr('abc123', '--theme')).toBe('data-e-abc123-theme');
  });
});
