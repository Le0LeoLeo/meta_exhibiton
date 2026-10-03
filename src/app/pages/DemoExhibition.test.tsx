import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../components/I18nProvider';
import { useMetaverseStudioStore } from '../modules/metaverse3d/store/useMetaverseStudioStore';
import DemoExhibition from './DemoExhibition';
import { createDemoScene, demoExhibitions } from '../features/public-demo/demoScene';

const { supported, failCanvas } = vi.hoisted(() => ({ supported: { value: false }, failCanvas: { value: false } }));
vi.mock('../modules/metaverse3d/components/webglSupport', () => ({ canCreateWebGLContext: () => supported.value }));
vi.mock('../features/metaverse-studio/app/GalleryScenePreview', () => ({ GalleryScenePreview: ({ focusedIndex }: { focusedIndex: number }) => {
  if (failCanvas.value) throw new Error('WebGL unavailable');
  return <div data-testid="demo-canvas">Artwork {focusedIndex + 1}</div>;
} }));


function renderDemo(path = '/demo') { return render(<MemoryRouter initialEntries={[path]}><I18nProvider><DemoExhibition /></I18nProvider></MemoryRouter>); }

describe('official public demo', () => {
  beforeEach(() => { supported.value = false; failCanvas.value = false; localStorage.clear(); localStorage.setItem('metaexpo-locale', 'zh-TW'); });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('provides all artwork details without WebGL, authentication or draft writes', () => {
    const before = JSON.stringify(useMetaverseStudioStore.getState().exportScene());
    renderDemo();
    expect(screen.getByRole('status')).toHaveTextContent('此裝置目前無法顯示 3D 展廳');
    expect(screen.getByRole('button', { name: '3D 展廳' })).toBeDisabled();
    expect(screen.getByRole('heading', { name: '神奈川沖浪裏' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '下一件' }));
    expect(screen.getByRole('heading', { name: '有柏樹的麥田' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '持水壺的年輕女子' }));
    expect(screen.getByRole('heading', { name: '持水壺的年輕女子' })).toBeInTheDocument();
    expect(screen.getByText('約翰尼斯・維梅爾 · ca. 1662')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '館藏來源：大都會藝術博物館 · CC0' })).toHaveAttribute('href', 'https://www.metmuseum.org/art/collection/search/437881');
    expect(screen.getByRole('link', { name: '返回首頁' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: '建立我的展覽' })).toHaveAttribute('href', '/virtual-gallery/quick-create');
    expect(JSON.stringify(useMetaverseStudioStore.getState().exportScene())).toBe(before);
  });

  it('changes 3D focus when a visitor selects an artwork and supports switching to 2D', async () => {
    supported.value = true;
    renderDemo();
    expect(await screen.findByTestId('demo-canvas')).toHaveTextContent('Artwork 1');
    fireEvent.click(screen.getByRole('button', { name: '持水壺的年輕女子' }));
    expect(screen.getByTestId('demo-canvas')).toHaveTextContent('Artwork 3');
    fireEvent.click(screen.getByRole('button', { name: '2D 圖文' }));
    expect(screen.getByRole('img', { name: '持水壺的年輕女子' })).toHaveAttribute('src', '/demo/met-437881.jpg');
  });

  it('offers 2D after the 3D module fails', async () => {
    supported.value = true;
    failCanvas.value = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderDemo();
    expect(await screen.findByRole('status')).toHaveTextContent('此裝置目前無法顯示 3D 展廳');
    fireEvent.click(screen.getAllByRole('button', { name: '2D 圖文' }).at(-1)!);
    expect(screen.getByRole('img', { name: '神奈川沖浪裏' })).toBeInTheDocument();
  });

  it('switches exhibitions, resets artwork selection and preserves correct source links', () => {
    renderDemo('/demo?exhibition=garden');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('印象・花園');
    fireEvent.click(screen.getByRole('button', { name: '下一件' }));
    expect(screen.getByRole('heading', { name: '玫瑰' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /館藏來源/ })).toHaveAttribute('href', 'https://www.metmuseum.org/art/collection/search/436534');
    fireEvent.click(screen.getByRole('link', { name: '浮世・山水' }));
    expect(screen.getByRole('heading', { name: '神奈川沖浪裏' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '上一件' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '下一件' }));
    expect(screen.getByRole('img', { name: '駿州片倉茶園之不二' })).toHaveAttribute('src', '/demo/met-56213.jpg');
  });

  it('falls back to the original exhibition for unknown links', () => {
    renderDemo('/demo?exhibition=missing');
    expect(screen.getByRole('heading', { name: '神奈川沖浪裏' })).toBeInTheDocument();
  });

  it.each(demoExhibitions)('can reach the last artwork in $id and navigate back', exhibition => {
    renderDemo(`/demo?exhibition=${exhibition.id}`);
    for (let i = 1; i < 11; i++) fireEvent.click(screen.getByRole('button', { name: '下一件' }));
    expect(screen.getByText('11 / 11')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下一件' })).toBeDisabled();
    const last = exhibition.artworks[10];
    expect(screen.getByRole('link', { name: /館藏來源/ })).toHaveAttribute('href', `https://www.metmuseum.org/art/collection/search/${last.id}`);
    fireEvent.click(screen.getByRole('button', { name: '上一件' }));
    expect(screen.getByText('10 / 11')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下一件' })).toBeEnabled();
  });

  it.each(demoExhibitions)('links $id to the native participation document', exhibition => {
    supported.value = true;
    const before = JSON.stringify(useMetaverseStudioStore.getState().exportScene());
    renderDemo(`/demo?exhibition=${exhibition.id}`);
    fireEvent.click(screen.getByRole('button', { name: '下一件' }));
    expect(screen.getByRole('link', { name: '開始學習漫遊', exact: true })).toHaveAttribute('href', `/demo/participate?exhibition=${exhibition.id}&artwork=1`);
    expect(JSON.stringify(useMetaverseStudioStore.getState().exportScene())).toBe(before);
  });

  it('restores the selected artwork when returning from participation', () => {
    renderDemo('/demo?exhibition=garden&artwork=10');
    expect(screen.getByText('11 / 11')).toBeInTheDocument();
  });

  it('disables walkthrough when WebGL is unavailable', () => {
    renderDemo();
    expect(screen.getByRole('button', { name: '開始學習漫遊', exact: true })).toBeDisabled();
  });

  it('ships only local public-domain painting media and independent scene objects', () => {
    const scene = createDemoScene((key) => key);
    expect(scene.items).toHaveLength(11);
    expect(scene.items.every((item) => item.type === 'painting' && /^\/demo\/met-[0-9]+\.jpg$/.test(item.content))).toBe(true);
    scene.items[0].content = '/changed.svg';
    expect(createDemoScene((key) => key).items[0].content).toBe('/demo/met-45434.jpg');
  });
});
