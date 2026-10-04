import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import EducationGuide from './EducationGuide';
import Resources from './Resources';

const i18n = vi.hoisted(() => ({ locale: 'en' as 'en' | 'zh-TW' | 'zh-CN' }));

vi.mock('../components/I18nProvider', () => ({
  useI18n: () => ({ locale: i18n.locale, t: (key: string) => key }),
}));

afterEach(() => {
  cleanup();
  i18n.locale = 'en';
});

describe('education guide', () => {
  it('connects students and teachers to real exhibition, collaboration, and visitor routes', () => {
    i18n.locale = 'en';
    render(<MemoryRouter><EducationGuide /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'Build, discuss, and question a 3D exhibition' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open class workspace' })).toHaveAttribute('href', '/graduation');
    expect(screen.getByRole('link', { name: 'Join a class exhibition' })).toHaveAttribute('href', '/graduation');
    expect(screen.getByRole('link', { name: 'Browse exhibitions' })).toHaveAttribute('href', '/exhibitions');
    expect(screen.getByText(/Review submitted project descriptions/)).toBeInTheDocument();
    expect(screen.getByText(/Check replies against the works and listed sources/)).toBeInTheDocument();
    expect(screen.getByText(/AI replies can be wrong or lack context/)).toBeInTheDocument();
  });

  it('keeps the three-language guide aligned around the same classroom tasks', () => {
    const expected = {
      en: ['Teacher: frame an inquiry', 'Student: curate and exchange ideas', 'Question the gallery Agent and verify'],
      'zh-TW': ['教師：設計探究問題', '學生：策展並交流觀點', '向展覽 Agent 提問並核對'],
      'zh-CN': ['教师：设计探究问题', '学生：策展并交流观点', '向展览 Agent 提问并核对'],
    } as const;

    for (const locale of ['en', 'zh-TW', 'zh-CN'] as const) {
      i18n.locale = locale;
      const { unmount } = render(<MemoryRouter><EducationGuide /></MemoryRouter>);
      for (const title of expected[locale]) expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
      expect(screen.getAllByRole('link')).toHaveLength(3);
      unmount();
    }
  });

  it('keeps Resources focused on the education guide and actual support entry', () => {
    render(<MemoryRouter><Resources /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'Build, discuss, and question a 3D exhibition' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'resourceContactSupportBtn' })).toHaveAttribute('href', '/support#faq-section');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument();
    expect(screen.queryByText('resourcePreparing')).not.toBeInTheDocument();
  });
});
