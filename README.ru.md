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
  <p>Трансформер ECSS AST → CSS + JS + TypeScript-декларации.</p>
  <br>
  <p>
    <a href="https://ecss.webea.ch/ru" style="font-size: 1.5em">📖 Документация</a> | <a href="https://ecss.webea.ch/ru/reference/spec.html" style="font-size: 1.5em">📋 Спецификация</a>
  </p>
</div>

---

## 💎 Особенности

- 🔄 **Один проход** — CSS, JS-биндинги и `.d.ts` генерируются одновременно из одного AST
- 📦 **Dual CJS/ESM** — `require` и `import` из коробки
- 🎨 **Гибкие имена классов** — настраиваемый шаблон с токенами `[name]` и `[hash:N]`
- ⚙️ **Конфигурационный файл** — `ecss.config.json` для проектных настроек по умолчанию
- 🧩 **Фреймворк-независим** — поддерживает React (`className`), Vue / Svelte / Solid (`class`) и оба варианта одновременно
- 🏃 **Runtime-хелперы** — минималистичный `_h` + `merge` в сабпасе `./runtime`
- 📝 **TypeScript** — типы в комплекте, перегрузки для позиционного и именованного вызова

---

## 📦 Установка

```bash
npm install @ecss/transformer
```

или

```bash
pnpm add @ecss/transformer
```

или

```bash
yarn add @ecss/transformer
```

---

## 🚀 Быстрый старт

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

console.log(css); // развёрнутый CSS с атрибутными селекторами
console.log(js); // ES-модуль с функцией Button(...)
console.log(dts); // TypeScript-декларации
```

---

## 🛠 API

### `transform(ast, config): TransformResult`

Главная функция. Принимает ECSS AST и конфигурацию, возвращает все три артефакта за один проход.

```ts
import { transform } from '@ecss/transformer';

const { css, js, dts } = transform(ast, {
  filePath: '/src/button.ecss',
  classTemplate: '[name]-[hash:8]', // по умолчанию '[name]-[hash:6]'
  classAttribute: 'className', // 'className' | 'class' | 'both'
  runtimeImport: '@ecss/transformer/runtime', // по умолчанию 'virtual:ecss/runtime'
});
```

### `generateDts(ast, config): string`

Генерирует только `.d.ts`-строку без CSS и JS. Удобно для sidecar-файлов рядом с `.ecss`-исходниками.

```ts
import { generateDts } from '@ecss/transformer';

const dts = generateDts(ast, {
  filePath: '/src/button.ecss',
  classAttribute: 'class',
});
```

### `loadConfig(projectRoot): EcssConfig`

Читает и парсит `ecss.config.json` из указанной директории. Возвращает пустой объект, если файл отсутствует или не читается.

```ts
import { loadConfig } from '@ecss/transformer';

const config = loadConfig(process.cwd());
```

### `mergeConfig(fileConfig, explicit): EcssConfig`

Объединяет файловую конфигурацию с явно переданными опциями. Явные значения имеют приоритет; `undefined`-значения игнорируются и не перезатирают файловые настройки.

```ts
import { loadConfig, mergeConfig } from '@ecss/transformer';

const fileConfig = loadConfig(process.cwd());
const merged = mergeConfig(fileConfig, { classAttribute: 'class' });
```

---

## ⚙️ Конфигурация

### `TransformConfig`

```ts
interface TransformConfig {
  filePath: string; // путь к .ecss файлу, обязателен (используется для хеша)
  classTemplate?: string; // шаблон имени класса, по умолчанию '[name]-[hash:6]'
  classAttribute?: ClassAttribute; // 'className' | 'class' | 'both', по умолчанию 'className'
  runtimeImport?: string; // путь импорта рантайма, по умолчанию 'virtual:ecss/runtime'
}
```

### `DtsConfig`

```ts
interface DtsConfig {
  filePath: string;
  classTemplate?: string;
  classAttribute?: ClassAttribute; // по умолчанию 'className'
}
```

### `EcssConfig` (`ecss.config.json`)

```ts
interface EcssConfig {
  classAttribute?: ClassAttribute; // по умолчанию 'className'
  classTemplate?: string; // по умолчанию '[name]-[hash:6]'
  generateDeclarations?: boolean; // генерировать .ecss.d.ts рядом с исходниками
}
```

Файл `ecss.config.json` в корне проекта задаёт настройки по умолчанию для всех `.ecss`-файлов:

```json
{
  "classAttribute": "class",
  "classTemplate": "[name]-[hash:8]",
  "generateDeclarations": true
}
```

### Шаблон имени класса

Строка `classTemplate` поддерживает два токена:

| Токен      | Описание                                        |
| ---------- | ----------------------------------------------- |
| `[name]`   | Идентификатор `@state-def` (например, `Button`) |
| `[hash]`   | Первые 6 символов SHA-256 от `filePath + name`  |
| `[hash:N]` | Первые `N` символов хеша                        |

Пример: `"[name]-[hash:8]"` для `Button` даст что-то вроде `Button-a1b2c3d4`.

---

## 📐 Формат вывода

### CSS

Все `@state-def` разворачиваются в плоские CSS-правила с атрибутными селекторами `data-e-<hash>-<param>`:

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

ES-модуль с именованными state-функциями и хелпером `merge`:

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

TypeScript-декларации с перегрузками для позиционного и именованного вызова:

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

Минималистичный рантайм для вычисления атрибутов на клиенте. Обычно используется через виртуальный модуль `virtual:ecss/runtime` из `@ecss/unplugin`, но можно подключить напрямую.

### `_h(className, params, classFields)`

Создаёт state-функцию для одного `@state-def`. Возвращает функцию, которую можно вызвать позиционно или с именованным объектом:

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

Объединяет несколько результатов state-функций в один объект. Значения `class` / `className` конкатенируются через пробел; остальные атрибуты перезаписываются последним значением.

```ts
import { merge } from '@ecss/transformer/runtime';

const attrs = merge(Button('dark'), Icon({ size: 'sm' }));
// → { className: 'Button-a1b2c3 Icon-def456', 'data-e-def456-size': 'sm', ... }
```

---

## 🔧 Разработка

**Сборка:**

```bash
pnpm build    # production
pnpm dev      # watch mode
```

**Тесты:**

```bash
pnpm test
pnpm test:watch
```

**Проверка типов:**

```bash
pnpm typecheck
```

**Линтинг и форматирование:**

```bash
pnpm lint         # oxlint
pnpm lint:fix     # oxlint --fix
pnpm fmt          # oxfmt
pnpm fmt:check    # oxfmt --check
```

---

## 👨‍💻 Автор

Разработка и поддержка: [Руслан Мартынов](https://github.com/ruslan-mart)

Если нашёл баг или есть предложение — открывай issue или отправляй pull request.

---

## 📄 Лицензия

Распространяется под [лицензией MIT](./LICENSE).
