import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GalleryTemplatePreview } from './GalleryTemplatePreview';
import { getTemplateSceneJson } from '../constants/gallerySceneTemplates';

vi.mock('./I18nProvider', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('../features/metaverse-studio/preview', () => ({ GalleryScenePreview: ({ scene, focusedIndex }: any) => <div data-testid="scene" data-wall-color={scene.roomSize.wallColor}>{scene.roomSize.width}:{focusedIndex}</div> }));
afterEach(cleanup);

describe('template previews', () => {
  it('uses a dark template default while accepting an explicit bright override', async () => {
    const { rerender } = render(<GalleryTemplatePreview title="科技展示廳" />);
    expect(await screen.findByTestId('scene')).toHaveAttribute('data-wall-color', JSON.parse(getTemplateSceneJson('科技展示廳')!).roomSize.wallColor);
    rerender(<GalleryTemplatePreview title="科技展示廳" atmosphere="bright" />);
    expect(screen.getByTestId('scene')).toHaveAttribute('data-wall-color', JSON.parse(getTemplateSceneJson('科技展示廳', 'bright')!).roomSize.wallColor);
  });
  it('opens 3D for a saved atmosphere and reopens it only when atmosphere changes', async () => {
    const { rerender } = render(<GalleryTemplatePreview title="現代藝術畫廊" atmosphere="warm" />);
    await screen.findByTestId('scene');
    fireEvent.click(screen.getByRole('button', { name: 'demo3D' }));
    expect(screen.queryByTestId('scene')).not.toBeInTheDocument();
    rerender(<GalleryTemplatePreview title="現代藝術畫廊" atmosphere="warm" />);
    expect(screen.queryByTestId('scene')).not.toBeInTheDocument();
    rerender(<GalleryTemplatePreview title="現代藝術畫廊" atmosphere="bright" />);
    expect(await screen.findByTestId('scene')).toBeInTheDocument();
  });
  it('updates an open 3D preview when its atmosphere changes', async () => {
    const { rerender } = render(<GalleryTemplatePreview title="現代藝術畫廊" />);
    fireEvent.click(screen.getByRole('button', { name: 'demo3D' }));
    await screen.findByTestId('scene');
    rerender(<GalleryTemplatePreview title="現代藝術畫廊" atmosphere="spotlight" />);
    expect(screen.getByTestId('scene')).toHaveAttribute('data-wall-color', JSON.parse(getTemplateSceneJson('現代藝術畫廊', 'spotlight')!).roomSize.wallColor);
    rerender(<GalleryTemplatePreview title="現代藝術畫廊" atmosphere="warm" />);
    expect(screen.getByTestId('scene')).toHaveAttribute('data-wall-color', JSON.parse(getTemplateSceneJson('現代藝術畫廊', 'warm')!).roomSize.wallColor);
  });
  it('loads 3D only on request, visits each work, returns to the overview and unmounts it', async () => {
    render(<GalleryTemplatePreview title="汽車展示廳" />);
    expect(screen.queryByTestId('scene')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'demo3D' }));
    expect(await screen.findByTestId('scene')).toHaveTextContent('32:-1');
    fireEvent.click(screen.getByRole('button', { name: 'demoNext' }));
    expect(screen.getByTestId('scene')).toHaveTextContent('32:0');
    for (let index = 0; index < 6; index++) fireEvent.click(screen.getByRole('button', { name: 'demoNext' }));
    expect(screen.getByTestId('scene')).toHaveTextContent('32:-1');
    fireEvent.click(screen.getByRole('button', { name: 'demoPrevious' }));
    expect(screen.getByTestId('scene')).toHaveTextContent('32:5');
    fireEvent.click(screen.getByRole('button', { name: 'demo3D' }));
    expect(screen.queryByTestId('scene')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'vgPreviewPlan' })).toBeInTheDocument();
  });
});
