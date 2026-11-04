/// <reference types="node" />
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

const run = promisify(execFile);
const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** One temp repo root whose `src/` holds the given files. */
const fixtures: string[] = [];

async function fixture(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-check-'));
  fixtures.push(root);
  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(root, rel);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content, 'utf8');
  }
  return root;
}

/** Run one check script against a fixture root and report its public outcome. */
async function runCheck(
  script: string,
  root: string,
): Promise<{ code: number; stdout: string }> {
  try {
    const { stdout } = await run(process.execPath, [path.join(REPO_ROOT, 'scripts', script), root], {
      cwd: REPO_ROOT,
    });
    return { code: 0, stdout };
  } catch (error) {
    const failure = error as { code?: number; stdout?: string };
    return { code: failure.code ?? 1, stdout: failure.stdout ?? '' };
  }
}

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('check-vocabulary', () => {
  it('fails and names the file, line and term when src drifts back to the avoided word', async () => {
    const root = await fixture({
      'src/client/panel.ts': 'const WorkbenchScene = 1;\nexport default WorkbenchScene;\n',
    });

    const result = await runCheck('check-vocabulary.mjs', root);

    expect(result.code).toBe(1);
    expect(result.stdout).toContain('src/client/panel.ts:1');
    expect(result.stdout).toContain('场景');
  });

  it('passes on a clean tree and says how much it scanned', async () => {
    const root = await fixture({
      'src/client/panel.ts': 'const workbench = 1;\nexport default workbench;\n',
    });

    const result = await runCheck('check-vocabulary.mjs', root);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('clean');
    expect(result.stdout).toContain('1');
  });

  it('passes on this repository, whose src no longer carries the avoided word', async () => {
    const result = await runCheck('check-vocabulary.mjs', REPO_ROOT);

    expect(result.code).toBe(0);
  });
});

describe('check-design-tokens', () => {
  it('fails on a literal colour inside a button rule, naming the rule and the literal', async () => {
    const root = await fixture({
      'src/client/panel.ts':
        'export const CSS = `\n.dshwb-primary{background:var(--dsw-alias-button-primary-fill);color:#fff}\n`;\n',
    });

    const result = await runCheck('check-design-tokens.mjs', root);

    expect(result.code).toBe(1);
    expect(result.stdout).toContain('src/client/panel.ts:2');
    expect(result.stdout).toContain('.dshwb-primary');
    expect(result.stdout).toContain('#fff');
  });

  it('fails on a literal colour outside a button rule too', async () => {
    const root = await fixture({
      'src/client/panel.ts': 'export const CSS = `.dshwb-harness-title{color:#eef3fb}`;\n',
    });

    const result = await runCheck('check-design-tokens.mjs', root);

    expect(result.code).toBe(1);
    expect(result.stdout).toContain('.dshwb-harness-title');
    expect(result.stdout).toContain('#eef3fb');
  });

  it('allows the token island to declare the static colour values', async () => {
    const root = await fixture({
      'src/client/panel.ts':
        'export const CSS = `.dshwb-panel-root{--dsw-alias-label-primary:#f9fafb;--dshwb-glass:rgba(9,15,26,.62)}`;\n',
    });

    const result = await runCheck('check-design-tokens.mjs', root);

    expect(result.code).toBe(0);
  });

  it('leaves decorative shadows out of the colour ban', async () => {
    const root = await fixture({
      'src/client/panel.ts':
        'export const CSS = `.dshwb-panel{box-shadow:0 14px 36px rgba(0,0,0,.28)}`;\n',
    });

    const result = await runCheck('check-design-tokens.mjs', root);

    expect(result.code).toBe(0);
  });

  it('allows a literal that is only the fallback of a token', async () => {
    const root = await fixture({
      'src/client/panel.ts':
        'export const CSS = `.dshwb-secondary{color:var(--dsw-alias-label-primary,#f9fafb)}`;\n',
    });

    const result = await runCheck('check-design-tokens.mjs', root);

    expect(result.code).toBe(0);
  });

  it('fails when a button uses the brand colour as its foreground or focus ring', async () => {
    const root = await fixture({
      'src/client/panel.ts':
        'export const CSS = `.dshwb-primary:focus-visible{outline:2px solid var(--dsw-alias-brand-primary)}`;\n',
    });

    const result = await runCheck('check-design-tokens.mjs', root);

    expect(result.code).toBe(1);
    expect(result.stdout).toContain('--dsw-alias-brand-primary');
  });

  it('fails when a button reintroduces a brightness filter', async () => {
    const root = await fixture({
      'src/client/panel.ts':
        'export const CSS = `.dshwb-primary:hover{filter:brightness(1.08)}`;\n',
    });

    const result = await runCheck('check-design-tokens.mjs', root);

    expect(result.code).toBe(1);
    expect(result.stdout).toContain('brightness');
  });

  it('passes on this repository, whose button rules are fully tokenised', async () => {
    const result = await runCheck('check-design-tokens.mjs', REPO_ROOT);

    expect(result.code).toBe(0);
  });
});
