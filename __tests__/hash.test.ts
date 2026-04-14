import { applyTemplate, computeHash } from '../src/hash.js';

describe('computeHash', () => {
  it('returns a deterministic hash', () => {
    const h1 = computeHash('src/Button.ecss', 'Button');
    const h2 = computeHash('src/Button.ecss', 'Button');
    expect(h1).toBe(h2);
  });

  it('produces different hashes for different inputs', () => {
    const h1 = computeHash('src/Button.ecss', 'Button');
    const h2 = computeHash('src/Card.ecss', 'Card');
    expect(h1).not.toBe(h2);
  });

  it('differs when same name in different files', () => {
    const h1 = computeHash('src/a.ecss', 'Button');
    const h2 = computeHash('src/b.ecss', 'Button');
    expect(h1).not.toBe(h2);
  });
});

describe('applyTemplate', () => {
  it('applies default template', () => {
    const result = applyTemplate(undefined, 'Button', 'abcdef123456');
    expect(result).toBe('Button-abcdef');
  });

  it('applies custom template with hash length', () => {
    const result = applyTemplate('[name]_[hash:8]', 'Card', 'abcdef123456');
    expect(result).toBe('Card_abcdef12');
  });

  it('applies template without hash length', () => {
    const result = applyTemplate('[name]-[hash]', 'Panel', 'xyz123abc');
    expect(result).toBe('Panel-xyz123');
  });

  it('handles multiple [name] tokens', () => {
    const result = applyTemplate('[name]-[name]-[hash:3]', 'Foo', 'abcdef');
    expect(result).toBe('Foo-Foo-abc');
  });
});
