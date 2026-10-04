// Fixed synthetic cases only. No database, uploaded material, or automatic quality claims.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { suggestSkill } from '../server/services/graduationSkillService.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const categories = ['normal', 'missing', 'contradictory', 'link_only', 'adversarial'];

export function prepareEvaluation(cases, limit = 10) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 25) throw new Error('Limit must be 1–25');
  if (!Array.isArray(cases) || cases.length < 20 || new Set(cases.map(item => item.id)).size !== cases.length) throw new Error('Expected at least 20 uniquely identified fixed cases');
  for (const item of cases) {
    if (!categories.includes(item.category) || typeof item.input !== 'string' || !Array.isArray(item.sources) || !Array.isArray(item.expectedChecks) || !item.label?.startsWith('synthetic fixed test')) throw new Error('Invalid synthetic case');
    if (item.sources.some(source => !['text', 'url', 'link'].includes(source.kind) || typeof source.id !== 'string')) throw new Error('Invalid synthetic source');
  }
  const groups = categories.map(category => cases.filter(item => item.category === category));
  if (groups.some(group => group.length === 0)) throw new Error('All five categories are required');
  const balanced = [];
  for (let i = 0; balanced.length < cases.length; i++) {
    for (const group of groups) if (group[i]) balanced.push(group[i]);
  }
  return balanced.slice(0, limit).map(item => ({
    id: item.id, category: item.category, expectedChecks: item.expectedChecks,
    input: {
      context: 'Synthetic classroom reflection test. No real person or event.',
      role: '', actions: item.input, outcome: '', reflection: '',
      evidence: item.sources.map(source => ({ id: source.id, kind: source.kind === 'url' ? 'link' : source.kind,
        label: `Synthetic source ${source.id}`, source: 'Fixed synthetic evaluation fixture', visibility: 'private',
        content: source.kind === 'text' ? source.text : '', url: source.kind === 'text' ? '' : source.url,
      })),
    },
  }));
}

export async function runEvaluation(cases, { invoke = suggestSkill, repeats = 1 } = {}) {
  if (!Number.isInteger(repeats) || repeats < 1 || repeats > 2) throw new Error('Repeats must be 1 or 2');
  const results = [];
  for (const item of cases) {
    for (let repeat = 1; repeat <= repeats; repeat++) {
      const startedAt = new Date().toISOString();
      const start = performance.now();
      let result;
      try { result = await invoke(item.input); }
      catch { result = { status: 'error', warning: 'REQUEST_FAILED' }; }
      results.push({ caseId: item.id, category: item.category, repeat, startedAt,
        elapsedMs: Math.round(performance.now() - start), result,
        expectedChecks: item.expectedChecks, humanReview: { status: 'pending', supportedClaims: null, unsupportedClaims: null, notes: '' },
      });
    }
  }
  return { kind: 'synthetic-model-evaluation', educationalStudy: false, generatedAt: new Date().toISOString(),
    summary: { total: results.length, ready: results.filter(item => item.result.status === 'ready').length,
      fallback: results.filter(item => item.result.status === 'fallback').length, errors: results.filter(item => item.result.status === 'error').length,
      semanticQuality: 'Not automatically assessed; review each output against its fixed checks.' }, results };
}

async function main() {
  const args = process.argv.slice(2);
  const live = args.includes('--live');
  let limit = 10, repeats = 1;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--live') continue;
    if (arg === '--limit') limit = Number(args[++index]);
    else if (arg === '--repeats') repeats = Number(args[++index]);
    else throw new Error('Use --live, --limit 1..25, --repeats 1..2');
  }
  if (![1, 2].includes(repeats)) throw new Error('Repeats must be 1 or 2');
  const cases = prepareEvaluation(JSON.parse(await readFile(path.join(root, 'docs/competition-2026/ai-test-cases.json'), 'utf8')), limit);
  if (!live) {
    console.log(JSON.stringify({ mode: 'dry-run', calls: 0, plannedCalls: cases.length * repeats,
      cases: cases.map(item => ({ id: item.id, category: item.category })), instructions: 'Set provider environment variables and pass --live to execute synthetic cases.' }, null, 2));
    return;
  }
  if (!process.env.QWEN_API_KEY && !process.env.DASHSCOPE_API_KEY) throw new Error('A configured provider key is required; no requests sent');
  const report = await runEvaluation(cases, { repeats });
  const directory = path.join(root, '.tmp', `skill-ai-evaluation-${Date.now()}`);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'results.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ output: path.join(directory, 'results.json'), ...report.summary }, null, 2));
  if (report.summary.fallback || report.summary.errors) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(() => { console.error('Evaluation could not complete. Check arguments, fixture format and provider configuration; credentials are never printed.'); process.exitCode = 1; });
}
