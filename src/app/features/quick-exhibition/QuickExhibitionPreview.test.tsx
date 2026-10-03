import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/app/components/I18nProvider';
import type { QuickExhibitionDraft } from './types';
import { QuickExhibitionPreview } from './QuickExhibitionPreview';

const { supports3D, renderScene } = vi.hoisted(() => ({ supports3D: vi.fn(), renderScene: vi.fn() }));
vi.mock('@/app/modules/metaverse3d/components/webglSupport', () => ({ canCreateWebGLContext: supports3D }));
vi.mock('@/app/features/metaverse-studio/preview', () => ({
  GalleryScenePreview: (props: unknown) => { renderScene(props); return <div>3D scene</div>; },
}));

function draftFixture(): QuickExhibitionDraft {
  const assets = ['wide', 'tall'].map((id, order) => ({
    assetId: id, clientFileId: id, order, fileName: `${id}.png`, mimeType: 'image/png',
    width: order ? 400 : 1200, height: 800, title: id, artist: '', description: '',
    url: `/api/media/${id}`, previewUrl: `/api/media/${id}?accessToken=fresh`,
  }));
  return {
    draftId: 'draft', galleryId: 'gallery', revision: 2, status: 'ready',
    input: { title: 'My art', language: 'en', style: 'white-box', assets }, createdAt: '', updatedAt: '',
    result: {
      title: 'My art', layoutVersion: 1, includedAssetIds: ['wide', 'tall'], uploadedCount: 2, placedCount: 2, warnings: [],
      scene: {
        items: assets.map((asset) => ({
          id: `artwork-${asset.assetId}`, type: 'painting', assetId: asset.assetId,
          content: asset.url, assetUrl: asset.url, imageAspectRatio: asset.width / asset.height,
          position: [0, 1.55, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
        })),
      } as NonNullable<QuickExhibitionDraft['result']>['scene'],
    },
  };
}

beforeEach(() => {
  localStorage.setItem('metaexpo-locale', 'en');
  renderScene.mockClear();
  supports3D.mockReturnValue(true);
});
afterEach(cleanup);

describe('quick exhibition preview', () => {
  it('uses fresh preview URLs without changing the saved scene or artwork identity', async () => {
    const draft = draftFixture();
    const saved = JSON.stringify(draft);
    render(<I18nProvider><QuickExhibitionPreview draft={draft} /></I18nProvider>);
    await waitFor(() => expect(renderScene).toHaveBeenCalled());
    const props = renderScene.mock.lastCall![0];
    expect(props.scene.items.map((item: { content: string }) => item.content)).toEqual(draft.input.assets.map((asset) => asset.previewUrl));
    expect(props.scene.items.map((item: { assetId: string }) => item.assetId)).toEqual(['wide', 'tall']);
    fireEvent.click(screen.getByRole('button', { name: 'Next artwork' }));
    expect(renderScene.mock.lastCall![0].focusedIndex).toBe(1);
    expect(JSON.stringify(draft)).toBe(saved);
  });

  it('shows every actual artwork with details when WebGL is unavailable', () => {
    supports3D.mockReturnValue(false);
    render(<I18nProvider><QuickExhibitionPreview draft={draftFixture()} /></I18nProvider>);
    expect(screen.getAllByRole('img')).toHaveLength(2);
    expect(screen.getByText('The 3D preview is unavailable. You can still view your artwork in 2D.')).toBeInTheDocument();
    expect(renderScene).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'View artwork: tall' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('tall.png');
  });

  it('reports an image load failure without replacing it with an unrelated image', () => {
    supports3D.mockReturnValue(false);
    render(<I18nProvider><QuickExhibitionPreview draft={draftFixture()} /></I18nProvider>);
    fireEvent.error(screen.getByRole('img', { name: 'wide' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Image could not be loaded');
    expect(screen.queryByRole('img', { name: 'wide' })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'tall' })).toHaveAttribute('src', '/api/media/tall?accessToken=fresh');
  });
});
