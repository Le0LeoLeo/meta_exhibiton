import { readFileSync } from 'node:fs';
import { ESLint } from 'eslint';
import { expect, it } from 'vitest';
import ts from 'typescript';

it('blocks conditional Hooks and missing dependencies in production React code', async () => {
  const eslint = new ESLint();
  // Use a .tsx path covered by the real configuration; no test-only rule override.
  const [typed] = await eslint.lintText("import { useEffect } from 'react'; export function Probe({ enabled, value }: { enabled: boolean; value: string }) { if (enabled) useEffect(() => { document.title = value; }, []); return null; }", { filePath: 'src/app/components/QualityProbe.tsx' });
  expect(typed.messages).toEqual(expect.arrayContaining([
    expect.objectContaining({ ruleId: 'react-hooks/rules-of-hooks', severity: 2 }),
    expect.objectContaining({ ruleId: 'react-hooks/exhaustive-deps', severity: 2 }),
  ]));
});

it('keeps artwork inspector literals in the three-language catalog', () => {
  const path = 'src/app/modules/metaverse3d/components/UI/PaintingInspector.tsx';
  const tree = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const untranslated = [];
  function visit(node) {
    if ((ts.isJsxText(node) || ts.isStringLiteral(node) || ts.isTemplateExpression(node)) && /[\u3400-\u9fff]/.test(node.getText(tree))) untranslated.push(node.getText(tree));
    ts.forEachChild(node, visit);
  }
  visit(tree);
  expect(untranslated).toEqual([]);
});
