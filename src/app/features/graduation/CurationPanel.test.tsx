import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { createMemoryRouter, Link, Outlet, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { graduationRequest, suggestGraduationCuration, type CurationPlan, type GraduationProject } from '@/app/api/graduation';
import { UnsavedChangesProvider } from '@/app/components/UnsavedChangesProvider';
import { CurationPanel } from './CurationPanel';

vi.mock('@/app/api/graduation', () => ({ graduationRequest: vi.fn(), suggestGraduationCuration: vi.fn() }));
vi.mock('@/app/components/I18nProvider', () => ({ useI18n: () => ({ locale: 'en' }) }));
const projects: GraduationProject[] = [{ id: 'a', classId: 'class', ownerId: 'student', authorName: 'Student', title: 'Archive', researchQuestion: 'Memory?', concept: 'Community', process: 'Interview', outcome: 'Archive', team: '', supervisor: '', status: 'approved', revision: 3, feedback: '', createdAt: '', updatedAt: '' }];
const plan: CurationPlan = { revision: 0, source: 'rules', warnings: ['AI_UNAVAILABLE'], projectRevisions: { a: 3 }, groups: [{ title: 'Group 1', rationale: 'Project creation order only', projectIds: ['a'] }] };
beforeEach(() => {
  vi.mocked(graduationRequest).mockReset();
  vi.mocked(suggestGraduationCuration).mockReset().mockImplementation((classId, language) => graduationRequest(`/classes/${encodeURIComponent(classId)}/curation/suggest`, 'POST', { language }));
  vi.spyOn(window, 'confirm').mockReturnValue(false);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function mount(content: ReactNode = <CurationPanel classId="class" projects={projects} />) {
  const router = createMemoryRouter([{
    element: <UnsavedChangesProvider><Link to="/away">Global navigation</Link><Outlet /></UnsavedChangesProvider>,
    children: [{ path: '/', element: content }, { path: '/away', element: <h1>Away</h1> }],
  }], { initialEntries: ['/away', '/'], initialIndex: 1 });
  render(<RouterProvider router={router} />);
  return router;
}

function reloadIsBlocked() {
  const unload = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(unload);
  return unload.defaultPrevented;
}
describe('teacher grouping confirmation', () => {
  it('labels fallback truthfully and sends no save until explicit confirmation, preserving edits after conflict', async () => {
    vi.mocked(graduationRequest).mockResolvedValueOnce({ plan: null }).mockResolvedValueOnce({ plan }).mockRejectedValueOnce({ code: 'CURATION_STALE', status: 409 });
    mount();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Suggest groups' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Suggest groups' }));
    expect(await screen.findByText(/AI is unavailable or returned an invalid response/)).toBeVisible();
    const title = screen.getByLabelText('Group title 1');
    fireEvent.change(title, { target: { value: 'Human title' } });
    expect(screen.getByRole('button', { name: 'Confirm and save groups' })).toBeDisabled();
    expect(graduationRequest).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('checkbox', { name: 'I reviewed the grouping and explanations.' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and save groups' }));
    expect(await screen.findByRole('alert')).toBeVisible(); expect(title).toHaveValue('Human title');
    expect(reloadIsBlocked()).toBe(true);
    expect(graduationRequest).toHaveBeenLastCalledWith('/classes/class/curation', 'PUT', { expectedRevision: 0, projectRevisions: { a: 3 }, groups: [{ ...plan.groups[0], title: 'Human title' }] });
  });
  it('ignores a cancelled suggestion without replacing current edits', async () => {
    let finish!: (value: { plan: CurationPlan }) => void;
    vi.mocked(graduationRequest).mockResolvedValueOnce({ plan: { ...plan, revision: 1, source: 'manual', warnings: [] } }).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    mount();
    const title = await screen.findByLabelText('Group title 1');
    fireEvent.change(title, { target: { value: 'Keep this edit' } });
    vi.mocked(window.confirm).mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Suggest groups' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel request' }));
    await act(async () => finish({ plan }));
    expect(title).toHaveValue('Keep this edit');
    expect(graduationRequest).toHaveBeenCalledTimes(2);
    expect(reloadIsBlocked()).toBe(true);
  });
  it('disables stale plan saves while retaining editable content', async () => {
    vi.mocked(graduationRequest).mockResolvedValueOnce({ plan });
    mount(<CurationPanel classId="class" projects={[{ ...projects[0], revision: 4 }]} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Projects changed');
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: 'Confirm and save groups' })).toBeDisabled();
    expect(screen.getByLabelText('Group title 1')).toHaveValue('Group 1');
  });
  it('refreshes parent project revisions after a cross-session update so a fresh suggestion can be confirmed', async () => {
    const fresh = { ...plan, projectRevisions: { a: 4 } };
    vi.mocked(graduationRequest).mockResolvedValueOnce({ plan }).mockResolvedValueOnce({ plan: fresh }).mockResolvedValueOnce({ plan: { ...fresh, revision: 1, source: 'manual', warnings: [] } });
    const refresh = vi.fn();
    function ClassFixture() {
      const [current, setCurrent] = useState(projects);
      return <CurationPanel classId="class" projects={current} onRefresh={() => { refresh(); setCurrent([{ ...projects[0], revision: 4 }]); }} />;
    }
    mount(<ClassFixture />);
    await screen.findByLabelText('Group title 1');
    fireEvent.click(screen.getByRole('button', { name: 'Suggest groups' }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: 'Confirm and save groups' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and save groups' }));
    await waitFor(() => expect(graduationRequest).toHaveBeenLastCalledWith('/classes/class/curation', 'PUT', expect.objectContaining({ projectRevisions: { a: 4 } })));
  });
  it('preserves exact membership while moving projects and reordering projects and groups', async () => {
    const threeProjects = ['a', 'b', 'c'].map((id) => ({ ...projects[0], id, title: `Project ${id}` }));
    const arranged = { ...plan, projectRevisions: { a: 3, b: 3, c: 3 }, groups: [
      { title: 'First', rationale: 'First theme', projectIds: ['a', 'b'] },
      { title: 'Second', rationale: 'Second theme', projectIds: ['c'] },
    ] };
    vi.mocked(graduationRequest).mockResolvedValueOnce({ plan: arranged }).mockImplementationOnce(async (_path, _method, body) => ({ plan: { ...arranged, groups: (body as { groups: CurationPlan['groups'] }).groups, revision: 1 } }));
    mount(<CurationPanel classId="class" projects={threeProjects} />);
    await screen.findByLabelText('Group title 1');
    fireEvent.change(screen.getByLabelText('Move to group: Project b'), { target: { value: '1' } });
    const bItem = screen.getByText('Project b').closest('li')!;
    fireEvent.click(within(bItem).getByRole('button', { name: 'Move up' }));
    // Move the second group ahead of the first; project b must remain before c.
    fireEvent.click(screen.getAllByRole('button', { name: 'Move up' })[2]);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and save groups' }));
    await waitFor(() => expect(graduationRequest).toHaveBeenCalledTimes(2));
    const saved = vi.mocked(graduationRequest).mock.calls[1][2] as { groups: CurationPlan['groups'] };
    expect(saved.groups).toEqual([
      { title: 'Second', rationale: 'Second theme', projectIds: ['b', 'c'] },
      { title: 'First', rationale: 'First theme', projectIds: ['a'] },
    ]);
    expect(saved.groups.flatMap((g) => g.projectIds).sort()).toEqual(['a', 'b', 'c']);
  });

  it('preserves dirty groups when navigation or browser back is declined, and allows an explicit departure', async () => {
    vi.mocked(graduationRequest).mockResolvedValue({ plan });
    const router = mount();
    const title = await screen.findByLabelText('Group title 1');
    fireEvent.change(title, { target: { value: 'Unsaved teacher edit' } });
    expect(reloadIsBlocked()).toBe(true);
    fireEvent.click(screen.getByRole('link', { name: 'Global navigation' }));
    await waitFor(() => expect(window.confirm).toHaveBeenCalledOnce());
    expect(router.state.location.pathname).toBe('/');
    expect(title).toHaveValue('Unsaved teacher edit');
    await act(async () => { await router.navigate(-1); });
    expect(router.state.location.pathname).toBe('/');
    expect(title).toHaveValue('Unsaved teacher edit');
    vi.mocked(window.confirm).mockReturnValue(true);
    fireEvent.click(screen.getByRole('link', { name: 'Global navigation' }));
    expect(await screen.findByRole('heading', { name: 'Away' })).toBeVisible();
    expect(reloadIsBlocked()).toBe(false);
  });

  it('keeps edits without requesting another suggestion when replacement is declined', async () => {
    vi.mocked(graduationRequest).mockResolvedValueOnce({ plan });
    mount();
    const title = await screen.findByLabelText('Group title 1');
    fireEvent.change(title, { target: { value: 'Keep my grouping' } });
    fireEvent.click(screen.getByRole('button', { name: 'Suggest groups' }));
    expect(window.confirm).toHaveBeenCalledOnce();
    expect(graduationRequest).toHaveBeenCalledTimes(1);
    expect(title).toHaveValue('Keep my grouping');
    expect(reloadIsBlocked()).toBe(true);
  });

  it('preserves edits and reload protection when an accepted replacement request fails', async () => {
    vi.mocked(graduationRequest).mockResolvedValueOnce({ plan }).mockRejectedValueOnce(new Error('Suggestion failed'));
    mount();
    const title = await screen.findByLabelText('Group title 1');
    fireEvent.change(title, { target: { value: 'Retain after failure' } });
    vi.mocked(window.confirm).mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Suggest groups' }));
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(title).toHaveValue('Retain after failure');
    expect(reloadIsBlocked()).toBe(true);
  });

  it('protects an outstanding suggestion and clears protection after cancelling a clean request', async () => {
    let finish!: (value: { plan: CurationPlan }) => void;
    vi.mocked(graduationRequest).mockResolvedValueOnce({ plan }).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const router = mount();
    await screen.findByLabelText('Group title 1');
    expect(reloadIsBlocked()).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Suggest groups' }));
    expect(reloadIsBlocked()).toBe(true);
    fireEvent.click(screen.getByRole('link', { name: 'Global navigation' }));
    await waitFor(() => expect(window.confirm).toHaveBeenCalledOnce());
    expect(router.state.location.pathname).toBe('/');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel request' }));
    await act(async () => finish({ plan: { ...plan, groups: [{ ...plan.groups[0], title: 'Late response' }] } }));
    expect(screen.getByLabelText('Group title 1')).toHaveValue('Group 1');
    expect(reloadIsBlocked()).toBe(false);
  });

  it('keeps generated groups protected through saving and releases the guard only after a successful save', async () => {
    let finish!: (value: { plan: CurationPlan }) => void;
    vi.mocked(graduationRequest).mockResolvedValueOnce({ plan: null }).mockResolvedValueOnce({ plan })
      .mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    mount();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Suggest groups' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Suggest groups' }));
    await screen.findByLabelText('Group title 1');
    expect(reloadIsBlocked()).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: 'I reviewed the grouping and explanations.' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and save groups' }));
    expect(reloadIsBlocked()).toBe(true);
    await act(async () => finish({ plan: { ...plan, revision: 1 } }));
    expect(reloadIsBlocked()).toBe(false);
    fireEvent.click(screen.getByRole('link', { name: 'Global navigation' }));
    expect(await screen.findByRole('heading', { name: 'Away' })).toBeVisible();
    expect(window.confirm).not.toHaveBeenCalled();
  });
});
