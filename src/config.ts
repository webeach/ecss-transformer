import type { ClassAttribute } from './types.js';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CONFIG_FILENAME = 'ecss.config.json';

/** Project-level configuration read from `ecss.config.json`. */
export interface EcssConfig {
  /**
   * Which class attribute(s) the state function result should include.
   * @default "className"
   */
  classAttribute?: ClassAttribute;
  /**
   * Template for generated CSS class names.
   * Supports `[name]` and `[hash:N]` tokens.
   * @default "[name]-[hash:6]"
   */
  classTemplate?: string;
  /**
   * When `true`, the unplugin generates a `.ecss.d.ts` declaration file
   * alongside each `.ecss` source for IDE support (e.g. Svelte language tools).
   */
  generateDeclarations?: boolean;
}

/**
 * Reads and parses `ecss.config.json` from the given project root.
 * Returns an empty object when the file is absent or cannot be parsed.
 *
 * @param projectRoot Absolute path to the directory containing `ecss.config.json`.
 */
export function loadConfig(projectRoot: string): EcssConfig {
  try {
    const raw = readFileSync(join(projectRoot, CONFIG_FILENAME), 'utf-8');
    return JSON.parse(raw) as EcssConfig;
  } catch {
    return {};
  }
}

/**
 * Merges file-level config with explicit per-call overrides.
 *
 * Explicit values take precedence over file config; `undefined` explicit values
 * are ignored so that file defaults are preserved.
 *
 * @param fileConfig Config loaded from `ecss.config.json` via {@link loadConfig}.
 * @param explicit   Per-call overrides (e.g. from the Vite plugin options).
 */
export function mergeConfig(
  fileConfig: EcssConfig,
  explicit: Partial<EcssConfig>,
): EcssConfig {
  const result: EcssConfig = { ...fileConfig };

  if (explicit.classAttribute !== undefined) {
    result.classAttribute = explicit.classAttribute;
  }
  if (explicit.classTemplate !== undefined) {
    result.classTemplate = explicit.classTemplate;
  }
  if (explicit.generateDeclarations !== undefined) {
    result.generateDeclarations = explicit.generateDeclarations;
  }

  return result;
}
