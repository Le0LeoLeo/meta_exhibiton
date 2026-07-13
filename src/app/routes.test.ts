import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('app routes', () => {
  it('does not expose the misspelled virtual gallery upload route', () => {
    const routesSource = readFileSync(path.resolve(process.cwd(), 'src/app/routes.ts'), 'utf8');

    expect(routesSource).toContain("path: 'virtual-gallery/upload'");
    expect(routesSource).not.toContain('virtual-gallery/uploadupload');
  });
});
