<div align="center">
  <h1>@ecss/transformer</h1>
  <br>
  <img alt="@ecss/transformer" src="./assets/logo.svg" height="240">
  <br>
  <br>
  <p style="text-decoration: none">
    <a href="https://www.npmjs.com/package/@ecss/transformer">
       <img src="https://img.shields.io/npm/v/@ecss/transformer.svg?color=646fe1&labelColor=9B7AEF" alt="npm package" />
    </a>
    <a href="https://github.com/webeach/ecss-transformer/actions">
      <img src="https://img.shields.io/github/actions/workflow/status/webeach/ecss-transformer/ci.yml?color=646fe1&labelColor=9B7AEF" alt="build" />
    </a>
    <a href="https://www.npmjs.com/package/@ecss/transformer">
      <img src="https://img.shields.io/npm/dm/@ecss/transformer.svg?color=646fe1&labelColor=9B7AEF" alt="npm downloads" />
    </a>
  </p>
  <p><a href="./README.md">🇺🇸 English version</a> | <a href="./README.ru.md">🇷🇺 Русская версия</a></p>
  <p>ECSS AST → CSS + JS + TypeScript declaration transformer.</p>
  <br>
  <p>
    <a href="https://ecss.webea.ch" style="font-size: 1.5em">📖 Documentation</a> | <a href="https://ecss.webea.ch/reference/spec.html" style="font-size: 1.5em">📋 Specification</a>
  </p>
</div>

---

## 💎 Features

- 🔄 **Single pass** — CSS, JS bindings and `.d.ts` are all generated from one AST in one pass
- 📦 **Dual CJS/ESM** — `require` and `import` out of the box
- 🎨 **Flexible class names** — configurable template with `[name]` and `[hash:N]` tokens
- ⚙️ **Config file** — `ecss.config.json` for project-wide defaults
- 🧩 **Framework-agnostic** — supports React (`className`), Vue / Svelte / Solid (`class`) and both at once
- 🏃 **Runtime helpers** — minimal `_h` + `merge` available via the `./runtime` subpath
- 📝 **TypeScript** — types included, overloads for both positional and named-object call styles

---

## 📦 Installation

```bash
npm install @ecss/transformer
```

or

```bash
pnpm add @ecss/transformer
```

or

```bash
yarn add @ecss/transformer
```

---

## 🚀 Quick start

```ts
import { parseEcss } from '@ecss/parser';
import { transform } from '@ecss/transformer';

const source = `
  @state-variant Theme {
    values: light, dark;
  }

  @state-def Button(--theme Theme: "light", --disabled boolean: false) {
    border-radius: 6px;

    @if (--disabled) {
      opacity: 0.4;
      cursor: not-allowed;
    }

    @if (--theme == "light") {
      background: #fff;
      color: #111;
    }
    @else {
      background: #1e1e1e;
      color: #f0f0f0;
    }
  }
`;

const ast = parseEcss(source);

const { css, js, dts } = transform(ast, {
  filePath: '/src/button.ecss',
});

console.log(css); // expanded CSS with attribute selectors
console.log(js); // ES module with Button(...) function
console.log(dts); // TypeScript declarations
```

---

## 🛠 API

### `transform(ast, config): TransformResult`

The main entry point. Accepts an ECSS AST and config, returns all three artifacts in one pass.

```ts
import { transform } from '@ecss/transformer';

const { css, js, dts } = transform(ast, {
  filePath: '/src/button.ecss',
  classTemplate: '[name]-[hash:8]', // default: '[name]-[hash:6]'
  classAttribute: 'className', // 'className' | 'class' | 'both'
  runtimeImport: '@ecss/transformer/runtime', // default: 'virtual:ecss/runtime'
});
```

### `generateDts(ast, config): string`

Generates only the `.d.ts` string without CSS or JS. Useful for producing sidecar declaration files next to `.ecss` sources.

```ts
import { generateDts } from '@ecss/transformer';

const dts = generateDts(ast, {
  filePath: '/src/button.ecss',
  classAttribute: 'class',
});
```

### `loadConfig(projectRoot): EcssConfig`

Reads and parses `ecss.config.json` from the given directory. Returns an empty object when the file is absent or unreadable.

```ts
import { loadConfig } from '@ecss/transformer';

const config = loadConfig(process.cwd());
```

### `mergeConfig(fileConfig, explicit): EcssConfig`

Merges file-level config with explicit per-call overrides. Explicit values take precedence; `undefined` values are ignored so that file defaults are preserved.

```ts
import { loadConfig, mergeConfig } from '@ecss/transformer';

const fileConfig = loadConfig(process.cwd());
const merged = mergeConfig(fileConfig, { classAttribute: 'class' });
```

---

## ⚙️ Configuration

### `TransformConfig`

```ts
interface TransformConfig {
  filePath: string; // path to the .ecss file, required (used for hashing)
  classTemplate?: string; // class name template, default: '[name]-[hash:6]'
  classAttribute?: ClassAttribute; // 'className' | 'class' | 'both', default: 'className'
  runtimeImport?: string; // runtime import specifier, default: 'virtual:ecss/runtime'
}
```

### `DtsConfig`

```ts
interface DtsConfig {
  filePath: string;
  classTemplate?: string;
  classAttribute?: ClassAttribute; // default: 'className'
}
```

### `EcssConfig` (`ecss.config.json`)

```ts
interface EcssConfig {
  classAttribute?: ClassAttribute; // default: 'className'
  classTemplate?: string; // default: '[name]-[hash:6]'
  generateDeclarations?: boolean; // generate .ecss.d.ts alongside sources
}
```

Place `ecss.config.json` in your project root to set defaults for all `.ecss` files:

```json
{
  "classAttribute": "class",
  "classTemplate": "[name]-[hash:8]",
  "generateDeclarations": true
}
```

### Class name template

The `classTemplate` string supports two tokens:

| Token      | Description                                                   |
| ---------- | ------------------------------------------------------------- |
| `[name]`   | The `@state-def` identifier (e.g. `Button`)                   |
| `[hash]`   | First 6 characters of the SHA-256 digest of `filePath + name` |
| `[hash:N]` | First `N` characters of the hash                              |

Example: `"[name]-[hash:8]"` for `Button` produces something like `Button-a1b2c3d4`.

---

## 📐 Output format

### CSS

Every `@state-def` is expanded into flat CSS rules with `data-e-<hash>-<param>` attribute selectors:

```css
.Button-a1b2c3 {
  border-radius: 6px;
}

.Button-a1b2c3[data-e-a1b2c3-disabled] {
  opacity: 0.4;
  cursor: not-allowed;
}

.Button-a1b2c3[data-e-a1b2c3-theme='light'] {
  background: #fff;
  color: #111;
}

.Button-a1b2c3[data-e-a1b2c3-theme='dark'] {
  background: #1e1e1e;
  color: #f0f0f0;
}
```

### JS

An ES module with named state functions and the `merge` helper:

```ts
import { _h, merge } from 'virtual:ecss/runtime';

const Button = _h(
  'Button-a1b2c3',
  [
    ['theme', 'data-e-a1b2c3-theme', 'v', 'light'],
    ['disabled', 'data-e-a1b2c3-disabled', 'b', false],
  ],
  ['className'],
);

export default { Button, merge };
```

### .d.ts

TypeScript declarations with overloads for both positional and named-object call styles:

```ts
type Theme = 'light' | 'dark';

interface ButtonResult {
  className: string;
  'data-e-a1b2c3-theme': string;
  'data-e-a1b2c3-disabled'?: '';
}

interface ButtonParams {
  theme?: Theme;
  disabled?: boolean;
}

interface EcssStyles {
  Button: {
    (theme?: Theme, disabled?: boolean): ButtonResult;
    (params: ButtonParams): ButtonResult;
  };
  merge: (
    ...results: Record<string, string | undefined>[]
  ) => Record<string, string | undefined>;
}

declare const styles: EcssStyles;
export default styles;
```

---

## 🏃 Runtime (`@ecss/transformer/runtime`)

A minimal runtime for computing element attributes on the client. Normally consumed via the `virtual:ecss/runtime` virtual module provided by `@ecss/vite-plugin`, but can also be imported directly.

### `_h(className, params, classFields)`

Creates a state function for a single `@state-def`. The returned function can be called positionally or with a named object:

```ts
import { _h } from '@ecss/transformer/runtime';

const Button = _h(
  'Button-a1b2c3',
  [
    ['theme', 'data-e-a1b2c3-theme', 'v', 'light'],
    ['disabled', 'data-e-a1b2c3-disabled', 'b', false],
  ],
  ['className'],
);

Button('dark', true);
// → { className: 'Button-a1b2c3', 'data-e-a1b2c3-theme': 'dark', 'data-e-a1b2c3-disabled': '' }

Button({ theme: 'dark' });
// → { className: 'Button-a1b2c3', 'data-e-a1b2c3-theme': 'dark' }
```

### `merge(...results)`

Merges multiple state function results into one object. `class` / `className` values are **concatenated** with a space; all other attributes are **overwritten** by the last non-`undefined` value.

```ts
import { merge } from '@ecss/transformer/runtime';

const attrs = merge(Button('dark'), Icon({ size: 'sm' }));
// → { className: 'Button-a1b2c3 Icon-def456', 'data-e-def456-size': 'sm', ... }
```

---

## 🔧 Development

**Build:**

```bash
pnpm build    # production
pnpm dev      # watch mode
```

**Tests:**

```bash
pnpm test
pnpm test:watch
```

**Type check:**

```bash
pnpm typecheck
```

**Lint and format:**

```bash
pnpm lint         # oxlint
pnpm lint:fix     # oxlint --fix
pnpm fmt          # oxfmt
pnpm fmt:check    # oxfmt --check
```

---

## 👨‍💻 Author

Developed and maintained by [Ruslan Martynov](https://github.com/ruslan-mart).

Found a bug or have a suggestion? Open an issue or submit a pull request.

---

## 📄 License

Distributed under the [MIT License](./LICENSE).
