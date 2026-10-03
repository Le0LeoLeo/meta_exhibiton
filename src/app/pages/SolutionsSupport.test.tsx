import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { I18nProvider } from '../components/I18nProvider';
import { dictionaries } from '../i18n/catalogs';
import Support from './Support';
import Solutions from './Solutions';

beforeEach(() => localStorage.setItem('metaexpo-locale', 'zh-TW'));
afterEach(() => { cleanup(); localStorage.removeItem('metaexpo-locale'); });
const renderPage = (page: React.ReactNode) => render(<MemoryRouter><I18nProvider>{page}</I18nProvider></MemoryRouter>);

describe('solutions and support journeys', () => {
  it('combines topic and text filters and resets an empty result', () => {
    renderPage(<Support />);
    fireEvent.click(screen.getByRole('button', { name: '建立展覽' }));
    expect(screen.getByRole('status')).toHaveTextContent('3');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'QR Code' } });
    expect(screen.getByRole('status')).toHaveTextContent('0');
    fireEvent.click(screen.getByRole('button', { name: '全部問題' }));
    expect(screen.getByRole('status')).toHaveTextContent('1');
    fireEvent.click(screen.getByRole('button', { name: '如何分享展覽連結或 QR Code？' }));
    expect(screen.getByRole('link', { name: '前往分享管理' })).toHaveAttribute('href', '/virtual-gallery/my-exhibitions');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'unmatched-query' } });
    fireEvent.click(screen.getAllByRole('button', { name: dictionaries['zh-TW'].supportClearSearch }).at(-1)!);
    expect(screen.getByRole('status')).toHaveTextContent('9');
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('connects AI education scenarios to student, teacher and exhibition workflows', () => {
    const { container } = renderPage(<Solutions />);
    const scenarios = container.querySelectorAll('article[id^="scenario-"]');
    expect(scenarios).toHaveLength(3);
    expect(container.querySelector('#scenario-student-projects')).not.toBeNull();
    expect(container.querySelector('#scenario-teacher-review')).not.toBeNull();
    expect(container.querySelector('#scenario-agent-inquiry')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'AI 教育應用，從作品走到反思。', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '選擇你的學習起點', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '學生反思與 AI 建議', level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '教師班級與評閱', level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '展覽中的 Agent 探究', level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '可用的教育工具', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('以 3D 展覽呈現學生作品及其背景。')).toBeInTheDocument();
    expect(screen.getByText('多人共同參觀，讓同學一起探索同一個展覽。')).toBeInTheDocument();
    expect(screen.getByText('學生可向 AI Agent 詢問已展示的作品內容。')).toBeInTheDocument();
    screen.getAllByRole('link', { name: '參觀學習示範展' }).forEach(link => expect(link).toHaveAttribute('href', '/demo'));
    screen.getAllByRole('link', { name: '進入學習工作台' }).forEach(link => expect(link).toHaveAttribute('href', '/graduation'));
    expect(screen.getByRole('link', { name: '加入班級，開始學習' })).toHaveAttribute('href', '/graduation#student');
    expect(screen.getByRole('link', { name: '回顧我的作品集' })).toHaveAttribute('href', '/graduation/portfolio');
    expect(screen.getByRole('link', { name: '建立或管理班級' })).toHaveAttribute('href', '/graduation#teacher');
    expect(screen.getByRole('link', { name: '先看展覽示範' })).toHaveAttribute('href', '/demo');
    const cycle = screen.getByRole('region', { name: '從作品出發，完成一次 AI 輔助學習' });
    expect(within(cycle).getAllByRole('listitem')).toHaveLength(3);
    expect(cycle).toHaveTextContent('不會自動評分或核准作品');
    expect(cycle).toHaveTextContent('只提供連結，不代表 AI 已閱讀網頁');
    expect(container.querySelector('a[href="/virtual-gallery/quick-create"]')).toBeNull();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /送出|預約/ })).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent(/企業|零售|博物館|競賽|品牌故事/);
  });

  it.each(['zh-TW', 'zh-CN', 'en'] as const)('shows actionable AI education guidance in %s', (locale) => {
    localStorage.setItem('metaexpo-locale', locale);
    const { container } = renderPage(<Solutions />);
    const dictionary = dictionaries[locale];
    expect(screen.getByRole('heading', { name: dictionary.aiEducationHeroTitle, level: 1 })).toBeVisible();
    screen.getAllByRole('link', { name: dictionary.aiEducationPrimary }).forEach(link => expect(link).toHaveAttribute('href', '/graduation'));
    expect(screen.getByRole('link', { name: dictionary.aiEducationStudentAction })).toHaveAttribute('href', '/graduation#student');
    expect(screen.getByRole('link', { name: dictionary.aiEducationTeacherAction })).toHaveAttribute('href', '/graduation#teacher');
    expect(screen.getByRole('link', { name: dictionary.aiEducationAgentAction })).toHaveAttribute('href', '/demo');
    expect(screen.getByText(dictionary.aiEducationGuidanceDesc)).toBeVisible();
    expect(container.textContent).not.toMatch(/\baiEducation[A-Z]/);
  });

  it('provides the new guidance in all three locales', () => {
    const keys = Object.keys(dictionaries['zh-TW']).filter(key => key.startsWith('ss'));
    expect(keys.length).toBeGreaterThan(50);
    for (const dictionary of Object.values(dictionaries)) {
      for (const key of keys) expect(dictionary[key], key).toBeTruthy();
    }
  });
});
