import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { Hero } from './Hero';
import { I18nProvider } from './I18nProvider';

vi.mock('./Gallery3D', () => ({
  Gallery3D: () => <div data-testid="gallery-preview" />,
}));

describe('Hero', () => {
  it('leads teachers and students directly into the 30-minute AI exhibition flow', () => {
    render(
      <MemoryRouter>
        <I18nProvider>
          <Hero />
        </I18nProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /教師.*學生.*30 分鐘.*AI.*多人 3D/,
    );
    expect(screen.getByRole('link', { name: /開始 AI 建展/ })).toHaveAttribute(
      'href',
      '/virtual-gallery/create',
    );
  });
});
