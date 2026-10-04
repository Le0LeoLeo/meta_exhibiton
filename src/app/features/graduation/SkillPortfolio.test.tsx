import { act, cleanup, fireEvent, render as renderBase, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/app/components/I18nProvider';
import { graduationRequest } from '@/app/api/graduation';
import type { SkillCard } from '@/app/api/skills';
import { SkillPortfolio } from './SkillPortfolio';
import { createMemoryRouter, Link, Outlet, RouterProvider } from 'react-router';
import { UnsavedChangesProvider } from '@/app/components/UnsavedChangesProvider';

vi.mock('@/app/api/graduation', () => ({ graduationRequest: vi.fn() }));

const draft: SkillCard = {
  id: 'skill-one', projectId: 'project-one', title: 'Community organising',
  context: 'School event', role: 'Coordinator', actions: 'Scheduled volunteers',
  outcome: 'Event held', reflection: 'Learned to delegate', summary: 'Organised volunteers',
  tags: ['planning'], visibility: 'private', evidence: [], status: 'draft', revision: 3,
};

beforeEach(() => {
  vi.mocked(graduationRequest).mockReset();
  vi.mocked(graduationRequest).mockResolvedValue({ skills: [draft] });
  localStorage.setItem('metaexpo-locale', 'zh-TW');
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const render = (ui: Parameters<typeof renderBase>[0]) => {
  const router = createMemoryRouter([{
    element: <I18nProvider><UnsavedChangesProvider><Link to="/away">Global navigation</Link><Outlet /></UnsavedChangesProvider></I18nProvider>,
    children: [{ path: '/', element: ui }, { path: '/away', element: <h1>Away</h1> }],
  }]);
  return renderBase(<RouterProvider router={router} />);
};

describe('student skill portfolio', () => {
  it('protects student sources and teacher feedback from navigation and same-page switching', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    vi.mocked(graduationRequest).mockResolvedValue({ skills: [
      { ...draft, status: 'submitted' }, { ...draft, id: 'second', title: 'Second card', status: 'submitted' },
    ] });
    render(<SkillPortfolio projectId="project-one" teacher />);
    const fields = await screen.findAllByLabelText('教師意見');
    fireEvent.focus(fields[0]);
    fireEvent.change(fields[0], { target: { value: 'Keep this feedback' } });
    fireEvent.focus(fields[1]);
    expect(confirm).toHaveBeenCalledOnce();
    expect(fields[0]).toHaveValue('Keep this feedback');
    fireEvent.focus(fields[0]);
    expect(fields[0]).toHaveValue('Keep this feedback');
    fireEvent.click(screen.getByRole('link', { name: 'Global navigation' }));
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(2));
    expect(fields[0]).toHaveValue('Keep this feedback');
  });

  it('guards unsaved skill evidence until the student accepts leaving', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<SkillPortfolio projectId="project-one" teacher={false} />);
    await screen.findByText('Community organising');
    fireEvent.click(screen.getByRole('button', { name: '加入來源' }));
    fireEvent.change(screen.getByLabelText('佐證內容'), { target: { value: 'Keep my evidence' } });
    fireEvent.click(screen.getByRole('link', { name: 'Global navigation' }));
    await waitFor(() => expect(confirm).toHaveBeenCalledOnce());
    expect(screen.getByDisplayValue('Keep my evidence')).toBeInTheDocument();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('link', { name: 'Global navigation' }));
    expect(await screen.findByRole('heading', { name: 'Away' })).toBeVisible();
  });
  it('defaults to English when no locale preference is saved', async () => {
    localStorage.removeItem('metaexpo-locale');
    render(<SkillPortfolio projectId="project-one" teacher={false} />);
    expect(await screen.findByRole('button', { name: 'Edit' })).toBeVisible();
    expect(localStorage.getItem('metaexpo-locale')).toBe('en');
  });

  it('requires a second, explicit action before deleting a draft', async () => {
    render(<SkillPortfolio projectId="project-one" teacher={false} />);
    expect(await screen.findByText('Community organising')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '刪除能力卡' }));
    expect(graduationRequest).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('group', { name: '確定刪除此草稿及其佐證？' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(screen.queryByRole('button', { name: '永久刪除' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '刪除能力卡' }));
    fireEvent.click(screen.getByRole('button', { name: '永久刪除' }));
    await waitFor(() => expect(graduationRequest).toHaveBeenCalledWith('/skills/skill-one', 'DELETE', { expectedRevision: 3 }));
  });

  it('does not offer deletion for an approved card', async () => {
    vi.mocked(graduationRequest).mockResolvedValue({ skills: [{ ...draft, status: 'approved' }] });
    render(<SkillPortfolio projectId="project-one" teacher={false} />);
    expect(await screen.findByText('Community organising')).toBeVisible();
    expect(screen.queryByRole('button', { name: '刪除能力卡' })).not.toBeInTheDocument();
  });

  it('records an edited AI draft only after the updated card is saved', async () => {
    vi.mocked(graduationRequest).mockImplementation(async (path, method) => {
      if (path === '/projects/project-one/skills' && (!method || method === 'GET')) return { skills: [draft] } as never;
      if (path.endsWith('/skills/suggest')) return { status: 'ready', inputRevision: 3, suggestions: [{ id: 'suggestion-one', title: 'Planning', summary: 'Planned an event', tags: ['planning'], evidenceIds: [] }], questions: [] } as never;
      if (path === '/skills/skill-one' && method === 'PATCH') return { skill: { ...draft, revision: 4 } } as never;
      if (path.endsWith('/decision')) return { suggestion: {} } as never;
      return { runs: [] } as never;
    });
    render(<SkillPortfolio projectId="project-one" teacher={false} />);
    expect(await screen.findByText('Community organising')).toBeVisible();
    expect(screen.getByRole('button', { name: '請 AI 根據佐證提出建議' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '編輯' }));
    fireEvent.click(screen.getByRole('button', { name: '請 AI 根據佐證提出建議' }));
    expect(await screen.findByText('Planned an event')).toBeVisible();
    expect(graduationRequest).toHaveBeenCalledWith('/projects/project-one/skills/suggest', 'POST', { skillId: 'skill-one', expectedRevision: 3, selectedEvidenceIds: [] }, { timeoutMs: 60000 });
    fireEvent.click(screen.getByRole('button', { name: '採用這份草稿' }));
    fireEvent.change(screen.getByLabelText('你為甚麼作出這個決定？'), { target: { value: 'The saved card supports this smaller claim.' } });
    expect(graduationRequest).not.toHaveBeenCalledWith(expect.stringContaining('/decision'), expect.anything(), expect.anything());
    fireEvent.click(screen.getByRole('button', { name: '儲存能力卡' }));
    await waitFor(() => expect(graduationRequest).toHaveBeenCalledWith(
      '/skills/skill-one/suggestions/suggestion-one/decision', 'POST',
      expect.objectContaining({ decision: 'adopted', summary: 'Planned an event', expectedRevision: 4, inputRevision: 3, reason: 'The saved card supports this smaller claim.', checkedEvidenceIds: [] }),
    ));
  });

  it('keeps the reason after a decision failure and retries without saving the card again', async () => {
    let current = draft;
    let decisionAttempts = 0;
    vi.mocked(graduationRequest).mockImplementation(async (path, method, body) => {
      if (path === '/projects/project-one/skills' && (!method || method === 'GET')) return { skills: [current] } as never;
      if (path.endsWith('/skills/suggest')) return { status: 'ready', inputRevision: 3, suggestions: [{ id: 'suggestion-one', title: 'Planning', summary: 'Planned an event', tags: ['planning'], evidenceIds: [] }], questions: [] } as never;
      if (path === '/skills/skill-one' && method === 'PATCH') {
        current = { ...current, title: 'Planning', summary: 'Planned an event', revision: 4 };
        return { skill: current } as never;
      }
      if (path.endsWith('/decision')) {
        decisionAttempts += 1;
        if (decisionAttempts === 1) throw new Error('temporary save failure');
        expect(body).toMatchObject({ expectedRevision: 4, inputRevision: 3, reason: 'The work log supports the claim.' });
        return { suggestion: {} } as never;
      }
      return { runs: [] } as never;
    });
    render(<SkillPortfolio projectId="project-one" teacher={false} />);
    expect(await screen.findByText('Community organising')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '編輯' }));
    fireEvent.click(screen.getByRole('button', { name: '請 AI 根據佐證提出建議' }));
    expect(await screen.findByText('Planned an event')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '採用這份草稿' }));
    fireEvent.change(screen.getByLabelText('你為甚麼作出這個決定？'), { target: { value: 'The work log supports the claim.' } });
    fireEvent.click(screen.getByRole('button', { name: '儲存能力卡' }));
    const retry = await screen.findByRole('button', { name: '記錄決定' });
    expect(screen.getByLabelText('你為甚麼作出這個決定？')).toHaveValue('The work log supports the claim.');
    fireEvent.click(retry);
    await waitFor(() => expect(decisionAttempts).toBe(2));
    expect(graduationRequest.mock.calls.filter(([path, method]) => path === '/skills/skill-one' && method === 'PATCH')).toHaveLength(1);
  });

  it('shows old missing reasons as not collected and avoids presenting needs-review citations as support', async () => {
    vi.mocked(graduationRequest).mockImplementation(async (path) => {
      if (path === '/projects/project-one/skills') return { skills: [draft] } as never;
      if (path === '/skills/skill-one/suggestions') return { runs: [{ id: 'run-one', inputRevision: 3, provider: 'qwen', model: null, status: 'ready', createdAt: '2026-09-25T00:00:00.000Z', evidenceAssessment: [], questions: [], suggestions: [{ id: 'suggestion-old', title: 'Overstated result', summary: 'A claim without support', tags: [], evidenceIds: ['unknown'], decision: 'rejected', reason: null, reviewStatus: 'needs_review' }] }] } as never;
      return { runs: [] } as never;
    });
    render(<SkillPortfolio projectId="project-one" teacher={false} />);
    expect(await screen.findByText('Community organising')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'AI 建議紀錄' }));
    expect(await screen.findByText('Overstated result')).toBeVisible();
    expect(screen.getByText(/未有收集理由/)).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('閱讀問題及來源');
    expect(screen.queryByText(/引用來源/)).not.toBeInTheDocument();
  });

  it('requires editing a needs-review draft before saving it as adopted', async () => {
    vi.mocked(graduationRequest).mockImplementation(async (path, method) => {
      if (path === '/projects/project-one/skills' && (!method || method === 'GET')) return { skills: [draft] } as never;
      if (path.endsWith('/skills/suggest')) return { status: 'ready', inputRevision: 3, suggestions: [{ id: 'suggestion-review', title: 'Planning', summary: 'Planned an event', tags: ['planning'], evidenceIds: [], reviewStatus: 'needs_review' }], questions: [] } as never;
      return { runs: [] } as never;
    });
    render(<SkillPortfolio projectId="project-one" teacher={false} />);
    expect(await screen.findByText('Community organising')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '編輯' }));
    fireEvent.click(screen.getByRole('button', { name: '請 AI 根據佐證提出建議' }));
    expect(await screen.findByText('Planned an event')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '採用這份草稿' }));
    fireEvent.change(screen.getByLabelText('你為甚麼作出這個決定？'), { target: { value: 'I checked the sources and revised the claim.' } });
    expect(screen.getByRole('button', { name: '儲存能力卡' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('請先修改這份草稿');
    expect(graduationRequest).not.toHaveBeenCalledWith('/skills/skill-one', 'PATCH', expect.anything());
    fireEvent.change(screen.getByLabelText('履歷摘要'), { target: { value: 'Helped organise an event.' } });
    expect(screen.getByRole('button', { name: '儲存能力卡' })).toBeEnabled();
  });

  it('prevents switching cards while an AI request is still pending', async () => {
    const second = { ...draft, id: 'skill-two', title: 'Team project' };
    let resolveSuggestion!: (value: unknown) => void;
    const suggestionPromise = new Promise<unknown>((resolve) => { resolveSuggestion = resolve; });
    vi.mocked(graduationRequest).mockImplementation(async (path, method) => {
      if (path === '/projects/project-one/skills' && (!method || method === 'GET')) return { skills: [draft, second] } as never;
      if (path.endsWith('/skills/suggest')) return suggestionPromise as never;
      return { runs: [] } as never;
    });
    render(<SkillPortfolio projectId="project-one" teacher={false} />);
    expect(await screen.findByText('Community organising')).toBeVisible();
    const firstCard = screen.getByText('Community organising').closest('article')!;
    fireEvent.click(within(firstCard).getByRole('button', { name: '編輯' }));
    fireEvent.click(screen.getByRole('button', { name: '請 AI 根據佐證提出建議' }));
    expect(screen.getByLabelText('能力或經歷標題')).toHaveValue('Community organising');
    for (const button of screen.getAllByRole('button', { name: '編輯' })) expect(button).toBeDisabled();
    expect(screen.getByRole('button', { name: '新增能力卡' })).toBeDisabled();
    await act(async () => { resolveSuggestion({ status: 'ready', inputRevision: 3, suggestions: [], questions: [] }); await suggestionPromise; });
    await waitFor(() => expect(screen.getByRole('button', { name: '新增能力卡' })).toBeEnabled());
    expect(screen.getByLabelText('能力或經歷標題')).toHaveValue('Community organising');
  });
});
