#!/usr/bin/env node
/**
 * Design-token guard: button rules must pair design tokens instead of literal
 * colours (docs/design/button-system.md §5.4). This version covers the rules
 * whose class name marks them as buttons; the remaining non-button literals are
 * tracked in the token follow-up ticket.
 *
 * Usage: node scripts/check-design-tokens.mjs [repo-root]
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCAN_EXTENSIONS = /\.(?:ts|tsx|js|mjs)$/;
const SKIP_DIRECTORIES = new Set(['node_modules', '__tests__']);

/** Selectors that are button rules, i.e. the surface this check owns. */
const BUTTON_SELECTOR = /\.dshwb-(?:btn|primary|secondary|link|icon-btn|harness-open|harness-card)(?![\w-])/;
/** Properties where the brand fill colour must never stand in for text/ring. */
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
let buttonRules = 0;
for (const file of files) {
  const text = await readFile(file, 'utf8');
  const relative = path.relative(root, file).replaceAll('\\', '/');
  for (const match of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1];
    if (!BUTTON_SELECTOR.test(selector)) continue;
    buttonRules += 1;
    const braceIndex = (match.index ?? 0) + match[0].indexOf('{');
    const line = text.slice(0, braceIndex).split('\n').length;
    const declarations = match[2];
    const stripped = withoutTokenFallbacks(declarations);
    const ruleName = selector.trim().split(/\s+/).pop() ?? selector.trim();
    const report = (detail) => violations.push(`${relative}:${line}: ${ruleName} ${detail}`);

    for (const literal of stripped.match(HEX_COLOUR) ?? []) report(`使用了字面量颜色 ${literal}`);
    for (const literal of stripped.match(RGB_COLOUR) ?? []) report(`使用了字面量颜色 ${literal}`);
    if (/filter\s*:\s*brightness/.test(stripped)) report('使用了 filter:brightness（改用 token 的 hover 填充）');
    for (const declaration of declarations.split(';')) {
      const separator = declaration.indexOf(':');
      if (separator < 0) continue;
      const property = declaration.slice(0, separator).trim().toLowerCase();
      const value = declaration.slice(separator + 1);
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
console.log(`design-tokens clean: ${String(buttonRules)} button rule(s) checked`);
