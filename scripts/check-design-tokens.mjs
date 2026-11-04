#!/usr/bin/env node
/**
 * Design-token guard: every workbench CSS rule must colour through tokens.
 *
 * Scope and exemptions come from docs/design/button-system.md §3.7:
 *  - every CSS rule in `src/**` is checked (not just buttons),
 *  - the token island (`--dshwb-panel-root`) is the one place static values live,
 *  - `var(--token, #fff)` fallbacks are allowed,
 *  - decorative shadows and gradients keep their literals.
 *
 * Usage: node scripts/check-design-tokens.mjs [repo-root]
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCAN_EXTENSIONS = /\.(?:ts|tsx|js|mjs)$/;
const SKIP_DIRECTORIES = new Set(['node_modules', '__tests__']);

/** Properties whose colours must come from tokens. */
const BANNED_PROPERTIES = new Set([
  'color',
  'background',
  'background-color',
  'border',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'border-color',
  'outline',
  'outline-color',
  'fill',
  'stroke',
]);
/** Properties where the brand fill colour must never stand in for a foreground. */
const FOREGROUND_PROPERTIES = new Set(['color', 'outline', 'outline-color', 'border', 'border-color']);
const HEX_COLOUR = /#[0-9a-fA-F]{3,8}\b/g;
const RGB_COLOUR = /\brgba?\([^)]*\)/g;

/** Every file under `dir` whose name matches the scan extensions. */
async function sourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry.name)) continue;
      files.push(...(await sourceFiles(full)));
      continue;
    }
    if (SCAN_EXTENSIONS.test(entry.name)) files.push(full);
  }
  return files;
}

/** Remove `var(...)` spans so a token fallback's literal is not a violation. */
function withoutTokenFallbacks(declarations) {
  let previous;
  let current = declarations;
  do {
    previous = current;
    current = previous.replace(/var\([^()]*\)/g, 'var()');
  } while (current !== previous);
  return current;
}

const root = process.argv[2] === undefined ? REPO_ROOT : path.resolve(process.argv[2]);
const sourceDir = path.join(root, 'src');
let files;
try {
  files = await sourceFiles(sourceDir);
} catch {
  console.error(`design-tokens: cannot read ${sourceDir}`);
  process.exit(2);
}

const violations = [];
let rules = 0;
for (const file of files) {
  const text = await readFile(file, 'utf8');
  const relative = path.relative(root, file).replaceAll('\\', '/');
  for (const match of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    // CSS-in-TS lives in template strings; only its last line is CSS.
    const selector = (match[1].split(/[\n`]/).pop() ?? match[1]).trim();
    // Every workbench class rule is checked, however it is prefixed (e.g. `select.dshwb-input`).
    if (!/\.dshwb-/.test(selector)) continue;
    // Only the island rule itself may declare static values; descendants are normal rules.
    if (selector === '.dshwb-panel-root') continue;
    rules += 1;
    const braceIndex = (match.index ?? 0) + match[0].indexOf('{');
    const line = text.slice(0, braceIndex).split('\n').length;
    const declarations = match[2];
    const ruleName = selector.split(/\s+/).pop() ?? selector;
    const report = (detail) => violations.push(`${relative}:${line}: ${ruleName} ${detail}`);

    if (/filter\s*:\s*brightness/.test(withoutTokenFallbacks(declarations))) {
      report('使用了 filter:brightness（改用 token 的 hover 填充）');
    }
    for (const declaration of declarations.split(';')) {
      const separator = declaration.indexOf(':');
      if (separator < 0) continue;
      const property = declaration.slice(0, separator).trim().toLowerCase();
      const value = declaration.slice(separator + 1);
      if (BANNED_PROPERTIES.has(property)) {
        const stripped = withoutTokenFallbacks(value);
        for (const literal of stripped.match(HEX_COLOUR) ?? []) {
          report(`${property} 使用了字面量颜色 ${literal}`);
        }
        for (const literal of stripped.match(RGB_COLOUR) ?? []) {
          report(`${property} 使用了字面量颜色 ${literal}`);
        }
      }
      if (FOREGROUND_PROPERTIES.has(property) && value.includes('--dsw-alias-brand-primary')) {
        report(`把 --dsw-alias-brand-primary 当作 ${property}（品牌色只做填充）`);
      }
    }
  }
}

if (violations.length > 0) {
  for (const violation of violations) console.log(violation);
  console.log(`design-tokens: ${violations.length} violation(s)`);
  process.exit(1);
}
console.log(`design-tokens clean: ${String(rules)} rule(s) checked`);
