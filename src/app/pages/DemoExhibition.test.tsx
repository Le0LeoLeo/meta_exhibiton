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
    expect(screen.getByText('日本木版畫如何改變了部分歐洲畫家的繪畫方式？')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '神奈川沖浪裏' })).toBeInTheDocument();
    expect(screen.getByText('我研究了這類版畫何時傳到歐洲，並寫下作為全班故事開端的展品說明。')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '同學留言' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '下一件' }));
    expect(screen.getByRole('heading', { name: '戴草帽的自畫像' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '有柏樹的麥田' }));
    expect(screen.getByRole('heading', { name: '有柏樹的麥田' })).toBeInTheDocument();
    expect(screen.getByText('梵高 · 1889')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '館藏來源：大都會藝術博物館 · CC0' })).toHaveAttribute('href', 'https://www.metmuseum.org/art/collection/search/436535');
    expect(screen.getByRole('link', { name: '返回首頁' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: '建立我的展覽' })).toHaveAttribute('href', '/virtual-gallery/quick-create');
    expect(JSON.stringify(useMetaverseStudioStore.getState().exportScene())).toBe(before);
  });

  it('changes 3D focus when a visitor selects an artwork and supports switching to 2D', async () => {
    supported.value = true;
    renderDemo();
    expect(await screen.findByTestId('demo-canvas')).toHaveTextContent('Artwork 1');
    fireEvent.click(screen.getByRole('button', { name: '有柏樹的麥田' }));
    expect(screen.getByTestId('demo-canvas')).toHaveTextContent('Artwork 3');
    fireEvent.click(screen.getByRole('button', { name: '2D 圖文' }));
    expect(screen.getByRole('img', { name: '有柏樹的麥田' })).toHaveAttribute('src', '/demo/met-436535.jpg');
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
    const total = exhibition.artworks.length;
    for (let i = 1; i < total; i++) fireEvent.click(screen.getByRole('button', { name: '下一件' }));
    expect(screen.getByText(`${total} / ${total}`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下一件' })).toBeDisabled();
    const last = exhibition.artworks[total - 1];
    expect(screen.getByRole('link', { name: /館藏來源/ })).toHaveAttribute('href', `https://www.metmuseum.org/art/collection/search/${last.id}`);
    fireEvent.click(screen.getByRole('button', { name: '上一件' }));
    expect(screen.getByText(`${total - 1} / ${total}`)).toBeInTheDocument();
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
    expect(scene.items).toHaveLength(demoExhibitions[0].artworks.length);
    expect(scene.items.every((item) => item.type === 'painting' && /^\/demo\/met-[0-9]+\.jpg$/.test(item.content))).toBe(true);
    scene.items[0].content = '/changed.svg';
    expect(createDemoScene((key) => key).items[0].content).toBe('/demo/met-45434.jpg');
  });
});
