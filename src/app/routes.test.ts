import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('app routes', () => {
  it('exposes the official demo outside the authentication boundary', () => {
    const routesSource = readFileSync(path.resolve(process.cwd(), 'src/app/routes.ts'), 'utf8');
    expect(routesSource.split('Component: RequireAuth')[0]).toContain("path: 'demo'");
    expect(routesSource).toContain("import('./pages/DemoExhibition')");
    expect(routesSource.split('Component: RequireAuth')[0]).toContain("path: '/demo/participate'");
  });
  it('does not expose the retired quick upload page', () => {
    const routesSource = readFileSync(path.resolve(process.cwd(), 'src/app/routes.ts'), 'utf8');

    expect(routesSource).not.toContain('virtual-gallery/upload');
    expect(routesSource).not.toContain('ExhibitionUploadPlatform');
  });

  it('does not expose growth or competition product routes', () => {
    const routesSource = readFileSync(path.resolve(process.cwd(), 'src/app/routes.ts'), 'utf8');

    expect(routesSource).not.toContain('growth-memories');
    expect(routesSource).not.toContain('GrowthMemories');
    expect(routesSource).not.toContain("path: 'competitions'");
    expect(routesSource).not.toContain("path: 'admin/competitions'");
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

  it('exposes privacy and terms pages without authentication', () => {
    const routesSource = readFileSync(path.resolve(process.cwd(), 'src/app/routes.ts'), 'utf8');

    expect(routesSource).toContain("path: 'privacy'");
    expect(routesSource).toContain("import('./pages/Privacy')");
    expect(routesSource).toContain("path: 'terms'");
    expect(routesSource).toContain("import('./pages/Terms')");
  });
});
