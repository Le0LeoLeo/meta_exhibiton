import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Exhibition2DView } from './Exhibition2DView';

describe('Exhibition2DView', () => {
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
    expect(screen.getByRole('list', { name: '展品清單' })).toBeInTheDocument();
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

    const link = screen.getByRole('link', { name: '播放《校園一天》影片（在新分頁開啟）' });
    expect(link).toHaveAttribute('href', '/film.mp4');
    expect(link).toHaveClass('focus-visible:ring-4');
    expect(screen.getByRole('img', { name: '校園一天的影片縮圖' })).toHaveAttribute('loading', 'lazy');
  });
});
