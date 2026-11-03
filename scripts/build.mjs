/**
 * Build both halves of the bundle from src/:
 *   src/client/index.ts → client.js (browser half, ModuleLoader dialect)
 *   src/host/index.ts   → index.js  (host half, plain ESM plugin)
 *
 * The page only loads one classic script per plugin, and that script must
 * register a factory with `window.__ModuleLoader__.load({ id, factory })`.
 * `react` stays external (the page provides it); everything else is bundled.
 *
 * Usage: node scripts/build.mjs [--watch]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const PKG_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PKG = JSON.parse(fs.readFileSync(path.join(PKG_DIR, 'package.json'), 'utf8'));
const CLIENT_OUT = path.join(PKG_DIR, 'client.js');
const HOST_OUT = path.join(PKG_DIR, 'index.js');
const MARKER = 'window.__ModuleLoader__.load(';

/** Shared client options: one-shot and watch must not drift apart. */
function clientOptions(logLevel) {
  return {
    entryPoints: [path.join(PKG_DIR, 'src/client/index.ts')],
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'browser',
    target: 'es2022',
    external: ['react'],
    legalComments: 'none',
    // The page runs UTF-8; default ascii escaping would escape the Chinese
    // dictionary text and make the artifact harder to read.
    charset: 'utf8',
    logLevel,
  };
}

/** Host half options: plain ESM cordis plugin, no browser globals. */
function hostOptions(logLevel) {
  return {
    entryPoints: [path.join(PKG_DIR, 'src/host/index.ts')],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    legalComments: 'none',
    logLevel,
  };
}

/** Wrap the bundled client CJS body in the ModuleLoader dialect. */
function wrapClient(body) {
  return [
    '// 由 scripts/build.mjs 从 src/client/** 生成 —— 不要手改本文件。',
    'window.__ModuleLoader__.load({',
    `  id: ${JSON.stringify(PKG.name)},`,
    '  factory: (require) => {',
    '    var module = { exports: {} };',
    '    var exports = module.exports;',
    '    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });',
    body,
    '    return module.exports;',
    '  },',
    '});',
    '',
  ].join('\n');
}

/** Fail the build instead of shipping an artifact the page cannot use. */
function assertClientArtifact(text) {
  if (!text.includes(MARKER)) {
    throw new Error('client artifact is missing the window.__ModuleLoader__.load( dialect');
  }
  if (!text.includes(`id: ${JSON.stringify(PKG.name)}`)) {
    throw new Error(`client artifact id is not ${PKG.name}`);
  }
  if (!text.trimEnd().endsWith('});')) {
    throw new Error('client artifact is not closed');
  }
  if (!text.includes('#version 300 es')) {
    throw new Error('client artifact lost the hero shader');
  }
  if (!text.includes('工作台')) {
    throw new Error('client artifact lost the locale dictionaries');
  }
}

/** Fail the build instead of shipping a host half the loader cannot mount. */
function assertHostArtifact(text) {
  if (!text.includes('export')) {
    throw new Error('host artifact is not an ES module');
  }
  if (!text.includes('apply')) {
    throw new Error('host artifact lost the apply export');
  }
}

/** Validate and write the client artifact; shared by one-shot and watch builds. */
function writeClientArtifact(body) {
  const artifact = wrapClient(body);
  assertClientArtifact(artifact);
  fs.writeFileSync(CLIENT_OUT, artifact);
  return artifact.length;
}

/** Validate and write the host artifact. */
function writeHostArtifact(body) {
  const artifact = '// 由 scripts/build.mjs 从 src/host/** 生成 —— 不要手改本文件。\n' + body;
  assertHostArtifact(artifact);
  fs.writeFileSync(HOST_OUT, artifact);
  return artifact.length;
}

async function buildHostOnce() {
  const result = await build(hostOptions('warning'));
  return writeHostArtifact(result.outputFiles[0].text);
}

if (process.argv.includes('--watch')) {
  const { context } = await import('esbuild');
  const [hostBytes] = await Promise.all([buildHostOnce()]);
  console.log(`index.js ${hostBytes} B`);
  const watcher = await context({
    ...clientOptions('silent'),
    plugins: [
      {
        name: 'module-loader-wrapper',
        setup(pluginBuild) {
          pluginBuild.onEnd((result) => {
            if (result.errors.length > 0) return;
            try {
              const bytes = writeClientArtifact(result.outputFiles[0].text);
              console.log(`[${new Date().toLocaleTimeString()}] client.js ${bytes} B`);
            } catch (error) {
              console.error('build failed:', error.message);
            }
          });
        },
      },
    ],
  });
  await watcher.watch();
  console.log('watching src/client/** → client.js（改 host 半边请重跑一次 build）');
} else {
  const result = await build(clientOptions('warning'));
  const clientBytes = writeClientArtifact(result.outputFiles[0].text);
  const hostBytes = await buildHostOnce();
  console.log(`client.js ${clientBytes} B, index.js ${hostBytes} B`);
}
