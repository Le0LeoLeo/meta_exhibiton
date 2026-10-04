// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkBundleBudget } from './check-bundle-budget.mjs';

const temporary = [];
const scratch = () => { const dir = mkdtempSync(path.join(tmpdir(), 'meta-budget-test-')); temporary.push(dir); return dir; };
const script = fileURLToPath(new URL('./check-bundle-budget.mjs', import.meta.url));
afterEach(() => temporary.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

describe('bundle budget', () => {
  it('measures nested assets at the boundary and rejects oversized JavaScript', () => {
    const dist = scratch();
    mkdirSync(path.join(dist, 'assets'));
    const file = path.join(dist, 'assets/app.js');
    writeFileSync(file, Buffer.alloc(800 * 1024));
    expect(checkBundleBudget(dist).passed).toBe(true);
    writeFileSync(file, Buffer.alloc(800 * 1024 + 1));
    expect(checkBundleBudget(dist).passed).toBe(false);
  });
  it.each([['style.css', 340], ['model.glb', 1800]])('rejects oversized %s', (name, limit) => {
    const dist = scratch();
    writeFileSync(path.join(dist, 'app.js'), '// app');
    writeFileSync(path.join(dist, name), Buffer.alloc(limit * 1024 + 1));
    expect(checkBundleBudget(dist).passed).toBe(false);
  });
  it('fails when no JavaScript exists', () => {
    expect(() => checkBundleBudget(scratch())).toThrow(/no JavaScript/);
  });
  it.each([['js', 700, 7, 'total JavaScript'], ['glb', 1700, 7, 'total GLB assets']])('rejects excessive total %s while individual files pass', (extension, size, count, label) => {
    const dist = scratch();
    writeFileSync(path.join(dist, 'app.js'), '// app');
    for (let index = 0; index < count; index += 1) writeFileSync(path.join(dist, `chunk-${index}.${extension}`), Buffer.alloc(size * 1024));
    const result = checkBundleBudget(dist);
    expect(result.passed).toBe(false);
    expect(result.measurements.filter(({ actual, limit }) => actual > limit).map((measurement) => measurement.label)).toEqual([label]);
  });
  it('checks the explicit CLI directory and retains the default dist directory', () => {
    const root = scratch();
    const dist = path.join(root, 'dist');
    const actual = path.join(root, 'actual');
    mkdirSync(dist);
    mkdirSync(actual);
    writeFileSync(path.join(dist, 'app.js'), '// small');
    writeFileSync(path.join(actual, 'app.js'), Buffer.alloc(800 * 1024 + 1));
    expect(spawnSync(process.execPath, [script], { cwd: root }).status).toBe(0);
    const result = spawnSync(process.execPath, [script, actual], { cwd: root, encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('FAIL largest JavaScript');
  });
  it('can be imported without inspecting cwd or printing output', () => {
    const url = new URL('./check-bundle-budget.mjs', import.meta.url).href;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(url)})`], { cwd: scratch(), encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });
});
