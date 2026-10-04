import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, useI18n } from '@/app/components/I18nProvider';
import { graduationRequest, type GraduationRelease } from '@/app/api/graduation';
import GraduationClassPage from './GraduationClassPage';
import GraduationPortfolio from './GraduationPortfolio';
import GraduationPublicPage from './GraduationPublicPage';

vi.mock('@/app/api/graduation', () => ({ graduationRequest: vi.fn(), exportGraduationData: vi.fn() }));
vi.mock('./ProjectDetails', () => ({ ProjectDetails: () => null, PublicProjectCard: ({ project }: { project: { title: string } }) => <article>{project.title}</article> }));
vi.mock('./ProjectEditor', () => ({ ProjectEditor: () => null }));
vi.mock('./ProjectReview', () => ({ ProjectReviews: () => null, TeacherDecision: () => null }));
vi.mock('./CurationPanel', () => ({ CurationPanel: () => null }));
vi.mock('./TeachingProgress', () => ({ DeadlineEditor: () => null, TeachingProgress: () => null }));
vi.mock('./ProjectQuestions', () => ({ QuestionInbox: () => null }));
vi.mock('./SkillPortfolio', () => ({ SkillPortfolio: () => null }));
vi.mock('./ProjectHistory', () => ({ ProjectHistory: () => null }));

const release: GraduationRelease = {
  id: 'release', classId: 'class', version: 1, token: 'public-token', title: 'Published class',
  description: 'Introduction', createdAt: '2026-09-01T00:00:00Z', withdrawnAt: null,
  projects: [{ id: 'project', title: 'My frozen project', authorName: 'Student', researchQuestion: '',
    concept: '', process: '', outcome: '', team: '', supervisor: '', withdrawnAt: null }],
};
const locales = [
  { locale: 'en', withdraw: 'Withdraw my project from this version', restore: 'Restore my project in this version',
    stop: 'Stop sharing this version', start: 'Restore sharing for this version' },
  { locale: 'zh-TW', withdraw: '撤下此版本中的我的作品', restore: '恢復此版本中的我的作品',
    stop: '停止公開此版本', start: '恢復公開此版本' },
  { locale: 'zh-CN', withdraw: '撤下此版本中的我的作品', restore: '恢复此版本中的我的作品',
    stop: '停止公开此版本', start: '恢复公开此版本' },
];
beforeEach(() => { vi.mocked(graduationRequest).mockReset(); localStorage.setItem('metaexpo-locale', 'en'); });
afterEach(cleanup);

describe('published graduation lifecycle controls', () => {
  it.each(locales)('withdraws and restores only the author snapshot in $locale', async ({ locale, withdraw, restore }) => {
    localStorage.setItem('metaexpo-locale', locale);
    let withdrawnAt: string | null = null;
    vi.mocked(graduationRequest).mockImplementation(async (path, method, body) => {
      if (method === 'POST') {
        expect(path).toBe('/releases/release/projects/project/visibility');
        withdrawnAt = (body as { visible: boolean }).visible ? null : '2026-09-02T00:00:00Z';
        return { ok: true };
      }
      return { projects: [], releases: [{ ...release, projects: [{ ...release.projects[0], withdrawnAt }] }] };
    });
    render(<I18nProvider><MemoryRouter><GraduationPortfolio /></MemoryRouter></I18nProvider>);
    fireEvent.click(await screen.findByRole('button', { name: withdraw }));
    expect(graduationRequest).toHaveBeenCalledWith('/releases/release/projects/project/visibility', 'POST', { visible: false });
    const restoreButton = await screen.findByRole('button', { name: restore });
    expect(screen.queryByRole('link', { name: /View public exhibition|查看公開展覽|查看公开展览/ })).not.toBeInTheDocument();
    fireEvent.click(restoreButton);
    expect(await screen.findByRole('button', { name: withdraw })).toBeEnabled();
    expect(graduationRequest).toHaveBeenCalledWith('/releases/release/projects/project/visibility', 'POST', { visible: true });
  });

  it.each(locales)('lets the class organiser stop and restore a version in $locale', async ({ locale, stop, start }) => {
    localStorage.setItem('metaexpo-locale', locale);
    let withdrawnAt: string | null = null;
    vi.mocked(graduationRequest).mockImplementation(async (path, method, body) => {
      if (method === 'POST') {
        expect(path).toBe('/releases/release/visibility');
        withdrawnAt = (body as { visible: boolean }).visible ? null : '2026-09-02T00:00:00Z';
        return { release: { ...release, withdrawnAt } };
      }
      if (path.endsWith('/releases')) return { releases: [{ ...release, withdrawnAt }] };
      return { class: { id: 'class', title: 'Class', role: 'teacher' }, projects: [], reviews: [] };
    });
    render(<I18nProvider><MemoryRouter initialEntries={['/classes/class']}><Routes>
      <Route path="/classes/:classId" element={<GraduationClassPage />} />
    </Routes></MemoryRouter></I18nProvider>);
    fireEvent.click(await screen.findByRole('button', { name: stop }));
    expect(graduationRequest).toHaveBeenCalledWith('/releases/release/visibility', 'POST', { visible: false });
    fireEvent.click(await screen.findByRole('button', { name: start }));
    expect(await screen.findByRole('button', { name: stop })).toBeEnabled();
    expect(graduationRequest).toHaveBeenCalledWith('/releases/release/visibility', 'POST', { visible: true });
  });

  it('keeps withdrawal controls honest when the request fails and does not expose teacher restore to authors', async () => {
    vi.mocked(graduationRequest).mockImplementation(async (_path, method) => {
      if (method === 'POST') throw { code: 'FORBIDDEN' };
      return { projects: [], releases: [{ ...release, withdrawnAt: '2026-09-02T00:00:00Z' }] };
    });
    render(<I18nProvider><MemoryRouter><GraduationPortfolio /></MemoryRouter></I18nProvider>);
    expect(await screen.findByText(/The organiser stopped sharing this entire version/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Restore sharing for this version' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw my project from this version' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have access');
    expect(screen.getByRole('button', { name: 'Withdraw my project from this version' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Restore my project in this version' })).not.toBeInTheDocument();
  });

  it('removes previously loaded public content when a later read reports withdrawal', async () => {
    vi.mocked(graduationRequest).mockResolvedValueOnce({ release }).mockRejectedValue({ status: 404, code: 'RELEASE_NOT_FOUND' });
    function ChangeLocale() { const { setLocale } = useI18n(); return <button onClick={() => setLocale('zh-TW')}>Change locale</button>; }
    render(<I18nProvider><MemoryRouter initialEntries={['/public/public-token']}><ChangeLocale /><Routes>
      <Route path="/public/:token" element={<GraduationPublicPage />} />
    </Routes></MemoryRouter></I18nProvider>);
    expect(await screen.findByRole('heading', { name: 'Published class' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Change locale' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('找不到這份內容'));
    expect(screen.queryByRole('heading', { name: 'Published class' })).not.toBeInTheDocument();
    expect(screen.queryByText('My frozen project')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '下載作品資料' })).not.toBeInTheDocument();
  });
});
