import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { I18nProvider } from '@/app/components/I18nProvider';
import { Exhibition2DView } from './Exhibition2DView';

describe('Exhibition2DView', () => {
  afterEach(() => window.localStorage.clear());

  it('renders a semantic artwork list with lazy media and reserved space', () => {
    render(<Exhibition2DView
      title="班級成果展"
      description="本學期作品"
      exhibits={[{
        id: 'photo',
        title: '海邊',
        artist: '小明',
        description: '夏日作品',
        kind: 'image',
        mediaUrl: '/photo.jpg',
        thumbnailUrl: '/photo.jpg',
        accessibleText: '海邊。作者：小明。夏日作品',
      }]}
    />);

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Artwork list' })).toBeInTheDocument();
    expect(screen.getByText('Artist: 小明')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '海邊' })).toBeInTheDocument();
    const image = screen.getByRole('img', { name: '海邊。作者：小明。夏日作品' });
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image.parentElement).toHaveClass('aspect-[4/3]');
  });

  it('provides a keyboard-focusable video thumbnail action', () => {
    render(<Exhibition2DView title="短片展" exhibits={[{
      id: 'film',
      title: '校園一天',
      artist: null,
      description: null,
      kind: 'video',
      mediaUrl: '/film.mp4',
      thumbnailUrl: '/film.jpg',
      accessibleText: '校園一天',
    }]} />);

    const link = screen.getByRole('link', { name: 'Play 校園一天 in a new tab' });
    expect(link).toHaveAttribute('href', '/film.mp4');
    expect(link).toHaveClass('focus-visible:ring-4');
    expect(screen.getByRole('img', { name: 'Thumbnail for 校園一天' })).toHaveAttribute('loading', 'lazy');
  });

  it('uses the selected language for empty 2D exhibitions', () => {
    window.localStorage.setItem('metaexpo-locale', 'zh-TW');
    render(<I18nProvider><Exhibition2DView title="空展覽" exhibits={[]} /></I18nProvider>);

    expect(screen.getByText('2D 圖文展覽')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('此展覽目前沒有可在 2D 模式顯示的作品。');
  });
  it('shows the creator learning story beside each work', () => {
    render(<I18nProvider><Exhibition2DView title="Class show" exhibits={[{
      id: 'wave', title: 'The Wave', artist: null, description: null, kind: 'image', mediaUrl: '/wave.jpg', thumbnailUrl: '/wave.jpg',
      accessibleText: 'The Wave', workContext: { contribution: 'I wrote the label.', reflection: 'Check sources first.' },
    }]} /></I18nProvider>);
    expect(screen.getByText('I wrote the label.')).toBeInTheDocument();
    expect(screen.getByText('Check sources first.')).toBeInTheDocument();
  });
});
