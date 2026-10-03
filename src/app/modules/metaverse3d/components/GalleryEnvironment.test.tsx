import { Suspense } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GalleryEnvironment } from './GalleryEnvironment';

const environment = vi.hoisted(() => ({ render: vi.fn() }));
vi.mock('@react-three/drei', () => ({ Environment: () => environment.render() }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function Gallery() {
  return <Suspense fallback={<p>Whole scene loading</p>}>
    <GalleryEnvironment brightness={1} /><p>Visible gallery</p>
  </Suspense>;
}

describe('optional gallery environment', () => {
  it('keeps the gallery visible while the environment loads and after it resolves', async () => {
    let complete!: () => void;
    let loaded = false;
    const pending = new Promise<void>(resolve => { complete = resolve; });
    environment.render.mockImplementation(() => {
      if (!loaded) throw pending;
      return <p>Environment ready</p>;
    });
    render(<Gallery />);
    expect(screen.getByText('Visible gallery')).toBeVisible();
    expect(screen.queryByText('Whole scene loading')).not.toBeInTheDocument();
    await act(async () => { loaded = true; complete(); await pending; });
    expect(screen.getByText('Environment ready')).toBeVisible();
    expect(screen.getByText('Visible gallery')).toBeVisible();
  });

  it('retains the gallery when the environment request fails', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const suppress = (event: ErrorEvent) => event.preventDefault();
    window.addEventListener('error', suppress);
    environment.render.mockImplementation(() => { throw new Error('HDR request failed'); });
    try {
      render(<Gallery />);
      expect(screen.getByText('Visible gallery')).toBeVisible();
      expect(screen.queryByText('Whole scene loading')).not.toBeInTheDocument();
    } finally { window.removeEventListener('error', suppress); }
  });
});
