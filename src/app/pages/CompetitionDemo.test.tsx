import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { I18nProvider, useI18n, type Locale } from '@/app/components/I18nProvider';
import CompetitionDemo from './CompetitionDemo';

function ApplicationLanguage() {
  const { locale } = useI18n();
  return <p aria-label="Application language">{locale}</p>;
}

function mount(locale: Locale = 'en') {
  localStorage.setItem('metaexpo-locale', locale);
  return render(<I18nProvider><MemoryRouter initialEntries={['/competition-demo']}>
    <ApplicationLanguage />
    <Routes>
      <Route path="/competition-demo" element={<CompetitionDemo />} />
      <Route path="/graduation" element={<h1>Student workspace</h1>} />
    </Routes>
  </MemoryRouter></I18nProvider>);
}

describe('competition demo orientation', () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
  });
  afterEach(() => { cleanup(); localStorage.clear(); });

  it.each<Locale>(['en', 'zh-TW', 'zh-CN'])('keeps the saved %s language on entry and after leaving the English demonstration', async (locale) => {
    mount(locale);
    expect(screen.getByLabelText('Application language')).toHaveTextContent(locale);
    expect(document.documentElement.lang).toBe(locale);
    expect(localStorage.getItem('metaexpo-locale')).toBe(locale);
    expect(screen.getByRole('main')).toHaveAttribute('lang', 'en');
    expect(screen.getByRole('link', { name: /Open student workspace/ })).toHaveAttribute('href', '/graduation#student');
    expect(screen.getByRole('link', { name: /Open my portfolio/ })).toHaveAttribute('href', '/graduation/portfolio');
    fireEvent.click(screen.getByRole('link', { name: /Open student workspace/ }));
    expect(await screen.findByRole('heading', { name: 'Student workspace' })).toBeVisible();
    expect(screen.getByLabelText('Application language')).toHaveTextContent(locale);
    expect(document.documentElement.lang).toBe(locale);
    expect(localStorage.getItem('metaexpo-locale')).toBe(locale);
  });

  it('labels the practice examples as synthetic and does not present them as live AI output', () => {
    mount();
    expect(screen.getByText(/fictional, not live AI output/)).toBeInTheDocument();
    expect(screen.getAllByText(/Synthetic practice card/)).toHaveLength(3);
    expect(screen.getByText(/not participant data, consent records, research results, or outputs from a live model/)).toBeInTheDocument();
  });
});
