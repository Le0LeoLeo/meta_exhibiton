import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { I18nProvider } from '../components/I18nProvider';
import UsageGuide from './UsageGuide';

describe('UsageGuide', () => {
  afterEach(() => { cleanup(); localStorage.clear(); });

  it.each(['en', 'zh-TW', 'zh-CN'])('lists five linkable task guides in %s', (locale) => {
    localStorage.setItem('metaexpo-locale', locale);
    render(<MemoryRouter><I18nProvider><UsageGuide /></I18nProvider></MemoryRouter>);
    const guides = screen.getAllByRole('article');
    expect(guides.map((guide) => guide.id)).toEqual(['guide-build', 'guide-visit', 'guide-ask', 'guide-layout', 'guide-care']);
    for (const guide of guides) expect(screen.getByRole('link', { name: guide.querySelector('h3')!.textContent! })).toHaveAttribute('href', `#${guide.id}`);
  });

  it('names the buttons visitors actually see', () => {
    render(<MemoryRouter><I18nProvider><UsageGuide /></I18nProvider></MemoryRouter>);
    expect(screen.getByText(/press Ask the Agent about this work/)).toBeInTheDocument();
    expect(screen.getByText(/Open Room chat at the bottom left/)).toBeInTheDocument();
  });
});
