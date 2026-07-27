import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('app routes', () => {
  it('does not expose the misspelled virtual gallery upload route', () => {
    const routesSource = readFileSync(path.resolve(process.cwd(), 'src/app/routes.ts'), 'utf8');

    expect(routesSource).toContain("path: 'virtual-gallery/upload'");
    expect(routesSource).not.toContain('virtual-gallery/uploadupload');
  });

  it('keeps growth memories and competitions available as vertical solutions', () => {
    const routesSource = readFileSync(path.resolve(process.cwd(), 'src/app/routes.ts'), 'utf8');

    expect(routesSource).toContain("path: 'growth-memories'");
    expect(routesSource).toContain("path: 'competitions'");
  });

  it('renders a recoverable page when the root route fails', () => {
    const routesSource = readFileSync(path.resolve(process.cwd(), 'src/app/routes.ts'), 'utf8');

    expect(routesSource).toContain("import { RouteErrorPage } from './components/RouteErrorPage'");
    expect(routesSource).toContain('errorElement: createElement(RouteErrorPage)');
  });

  it('exposes public exhibition souvenir cards without authentication', () => {
    const routesSource = readFileSync(path.resolve(process.cwd(), 'src/app/routes.ts'), 'utf8');

    expect(routesSource).toContain("path: 'souvenirs/:token'");
    expect(routesSource).toContain("import('./pages/ExhibitionSouvenir')");
  });
});
