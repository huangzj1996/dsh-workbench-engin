#!/usr/bin/env node
/**
 * Vocabulary guard: fail when `src/**` drifts back to a term the domain glossary
 * marks as avoided. The banned list is deliberately small and mechanical — only
 * words whose meaning is unambiguous, because the glossary's other `_Avoid_`
 * entries (「面板」, 「卡片」…) are legal in context and belong to review, not a grep.
 *
 * Usage: node scripts/check-vocabulary.mjs [repo-root]
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCAN_EXTENSIONS = /\.(?:ts|tsx|js|mjs|css|html)$/;
/** Fixtures and tests may quote a banned word on purpose; source is the contract. */
const SKIP_DIRECTORIES = new Set(['node_modules', '__tests__']);

/** Each entry names the glossary problem it enforces. */
const BANNED = [
  { pattern: /scene/i, term: 'scene' },
  { pattern: /scenario/i, term: 'scenario' },
  { pattern: /场景/, term: '场景' },
];
const REASON = 'GLOSSARY 把「场景」列为 Avoid：用「工作台 / workbench」';

/**
 * Every file under `dir` whose name matches the scan extensions, skipping
 * dependency and test directories. Missing `src/` is an error in the caller.
 */
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

const root = process.argv[2] === undefined ? REPO_ROOT : path.resolve(process.argv[2]);
const sourceDir = path.join(root, 'src');
let files;
try {
  files = await sourceFiles(sourceDir);
} catch {
  console.error(`vocabulary: cannot read ${sourceDir}`);
  process.exit(2);
}

const violations = [];
for (const file of files) {
  const text = await readFile(file, 'utf8');
  const lines = text.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    for (const { pattern, term } of BANNED) {
      if (!pattern.test(line)) continue;
      const relative = path.relative(root, file).replaceAll('\\', '/');
      violations.push(`${relative}:${index + 1}: 禁用词「${term}」—— ${REASON}`);
      break;
    }
  }
}

if (violations.length > 0) {
  for (const violation of violations) console.log(violation);
  console.log(`vocabulary: ${violations.length} violation(s)`);
  process.exit(1);
}
console.log(`vocabulary clean: ${files.length} file(s) under src/`);
