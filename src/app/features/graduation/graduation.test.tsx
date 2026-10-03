import { cleanup, fireEvent, render as renderBase, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, Link, MemoryRouter, Outlet, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/app/components/I18nProvider';
import { ProjectEditor } from './ProjectEditor';
import { ProjectReviews, TeacherDecision } from './ProjectReview';
import { useGraduationResource } from './shared';
import { PublicProjectCard } from './ProjectDetails';
import { StudentSubmissionFlow } from './StudentSubmissionFlow';
import { SkillPortfolio } from './SkillPortfolio';
import { graduationRequest, reviewGraduationProject, submitGraduationProject, type GraduationProject } from '@/app/api/graduation';
import { UnsavedChangesProvider } from '@/app/components/UnsavedChangesProvider';
import { listSkills } from '@/app/api/skills';
import type { ReactNode } from 'react';

vi.mock('@/app/api/graduation', () => ({ graduationRequest: vi.fn(), exportGraduationData: vi.fn(), submitGraduationProject: vi.fn(), reviewGraduationProject: vi.fn() }));
vi.mock('@/app/api/gallery', () => ({ getMyGalleries: vi.fn().mockResolvedValue({ galleries: [] }) }));
vi.mock('@/app/api/auth', () => ({ loadAuth: () => ({ token: 'test' }) }));
vi.mock('@/app/api/skills', () => ({
  listSkills: vi.fn().mockResolvedValue({ skills: [] }), createSkill: vi.fn(), updateSkill: vi.fn(), deleteSkill: vi.fn(),
  submitSkill: vi.fn(), reviewSkill: vi.fn(), suggestSkill: vi.fn(), listSkillSuggestions: vi.fn(), decideSkillSuggestion: vi.fn(),
}));
const project: GraduationProject = {
  id: 'project', classId: 'class', ownerId: 'student', authorName: 'Student', title: 'Original',
  researchQuestion: 'Question', concept: 'Concept', process: 'Process', outcome: 'Outcome', team: '', supervisor: '',
  galleryId: null, status: 'draft', revision: 2, feedback: '', createdAt: '', updatedAt: '',
};
beforeEach(() => {
  vi.mocked(graduationRequest).mockReset();
  vi.mocked(reviewGraduationProject).mockReset().mockResolvedValue({ project });
  vi.mocked(submitGraduationProject).mockReset().mockResolvedValue({ project });
  vi.mocked(listSkills).mockResolvedValue({ skills: [] });
  localStorage.setItem('metaexpo-locale', 'zh-TW');
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const render = (ui: Parameters<typeof renderBase>[0]) => renderBase(ui, { wrapper: I18nProvider });
function GuardedForm({ children }: { children: ReactNode }) {
  const router = createMemoryRouter([{
    element: <UnsavedChangesProvider><Link to="/away">Global navigation</Link><Outlet /></UnsavedChangesProvider>,
    children: [{ path: '/', element: children }, { path: '/away', element: <h1>Away</h1> }],
  }]);
  return <RouterProvider router={router} />;
}
describe('graduation workflow controls', () => {
  it('protects a project draft during route navigation and releases the guard after saving', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    vi.mocked(graduationRequest).mockResolvedValue({ project: { ...project, revision: 3 } });
    const saved = vi.fn();
    render(<GuardedForm><ProjectEditor classId="class" project={project} onSaved={saved} /></GuardedForm>);
    fireEvent.change(screen.getByLabelText(/作品名稱/), { target: { value: 'My draft' } });
    fireEvent.click(screen.getByRole('link', { name: 'Global navigation' }));
    await waitFor(() => expect(confirm).toHaveBeenCalledOnce());
    expect(screen.getByDisplayValue('My draft')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '儲存草稿' }));
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('link', { name: 'Global navigation' }));
    expect(await screen.findByRole('heading', { name: 'Away' })).toBeVisible();
    expect(confirm).toHaveBeenCalledOnce();
  });
  it('defaults to English when no locale preference is saved', async () => {
    localStorage.removeItem('metaexpo-locale');
    render(<GuardedForm><ProjectEditor classId="class" project={project} onSaved={vi.fn()} /></GuardedForm>);
    expect(await screen.findByRole('button', { name: 'Save draft' })).toBeVisible();
    expect(localStorage.getItem('metaexpo-locale')).toBe('en');
  });

  it('never exposes the previous class data under a newly requested class path', async () => {
    vi.mocked(graduationRequest).mockResolvedValueOnce({ title: 'Class A' }).mockImplementationOnce(() => new Promise(() => {}));
    function Resource({ path }: { path: string }) {
      const { value } = useGraduationResource<{ title: string }>(path);
      return <span>{value?.title || 'No class loaded'}</span>;
    }
    const view = render(<Resource path="/classes/a" />);
    expect(await screen.findByText('Class A')).toBeVisible();
    view.rerender(<Resource path="/classes/b" />);
    expect(screen.queryByText('Class A')).not.toBeInTheDocument();
  });
  it('locks the saved draft until its refreshed revision arrives', async () => {
    vi.mocked(graduationRequest).mockResolvedValue({ project: { ...project, revision: 3 } });
    const saved = vi.fn();
    render(<GuardedForm><ProjectEditor classId="class" project={project} onSaved={saved} /></GuardedForm>);
    fireEvent.click(screen.getByRole('button', { name: '儲存草稿' }));
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    expect(screen.getByLabelText(/作品名稱/)).toBeDisabled();
    expect(screen.getByRole('button', { name: '提交教師審核' })).toBeDisabled();
  });
  it('locks review text while the submitted comment is in flight', async () => {
    vi.mocked(graduationRequest).mockImplementation(() => new Promise(() => {}));
    render(<ProjectReviews projectId="project" reviews={[]} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('回覆內容'), { target: { value: 'Keep this comment' } });
    fireEvent.click(screen.getByRole('button', { name: '送出評語' }));
    expect(screen.getByLabelText('回覆內容')).toBeDisabled();
    expect(screen.getByLabelText('回覆內容')).toHaveValue('Keep this comment');
  });
  it('retains unsaved edits and prevents stale submission when a save conflicts', async () => {
    const saved = vi.fn();
    vi.mocked(graduationRequest).mockRejectedValue(Object.assign(new Error('conflict'), { status: 409, code: 'REVISION_CONFLICT' }));
    render(<GuardedForm><ProjectEditor classId="class" project={project} onSaved={saved} /></GuardedForm>);
    const title = screen.getByLabelText(/作品名稱/);
    fireEvent.change(title, { target: { value: 'My unsaved changes' } });
    expect(screen.getByRole('button', { name: '提交教師審核' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '儲存草稿' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('你的輸入仍保留');
    expect(title).toHaveValue('My unsaved changes');
    expect(saved).not.toHaveBeenCalled();
    expect(graduationRequest).toHaveBeenCalledWith('/projects/project', 'PATCH', expect.objectContaining({ expectedRevision: 2, title: 'My unsaved changes' }));
  });
  it('requires actionable feedback when returning a project', async () => {
    vi.mocked(graduationRequest).mockResolvedValue({ project }); const saved = vi.fn();
    render(<TeacherDecision project={{ ...project, status: 'submitted' }} skillCards={[]} onSaved={saved} />);
    fireEvent.click(screen.getByRole('button', { name: '退回修改' }));
    expect(screen.getByRole('alert')).toHaveTextContent('修改建議'); expect(graduationRequest).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('審核意見'), { target: { value: 'Explain your research method' } });
    fireEvent.click(screen.getByRole('button', { name: '退回修改' }));
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    expect(reviewGraduationProject).toHaveBeenCalledWith('project', expect.objectContaining({ expectedRevision: 2, decision: 'returned', skillCards: [] }));
  });
  it('waits for the teacher-visible card snapshot before allowing a combined decision', () => {
    render(<TeacherDecision project={{ ...project, status: 'submitted' }} onSaved={vi.fn()} />);
    expect(screen.getByRole('button', { name: '核准作品' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '退回修改' })).toBeDisabled();
    expect(reviewGraduationProject).not.toHaveBeenCalled();
  });
  it('previews saved cards and submits their exact revisions with the project', async () => {
    vi.mocked(listSkills).mockResolvedValue({ skills: [{
      id: 'skill-1', projectId: project.id, title: 'Teamwork', context: '', role: 'Coordinator', actions: 'Organised the group',
      outcome: '', reflection: 'I learned to listen', summary: '', tags: [], visibility: 'private', evidence: [],
      status: 'draft', revision: 4,
    }] });
    vi.mocked(graduationRequest).mockResolvedValue({ project: { ...project, status: 'submitted', revision: 3 } });
    const onSaved = vi.fn(); const onStepChange = vi.fn();
    render(<StudentSubmissionFlow classId="class" project={project} onSaved={onSaved} step={3} onStepChange={onStepChange} />);
    expect(await screen.findByText('Teamwork')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '提交給教師' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(submitGraduationProject).toHaveBeenCalledWith('project', 2, [{ id: 'skill-1', revision: 4 }]);
  });
  it('starts the guided reflection with the project title and leaves personal actions for the student', async () => {
    render(<GuardedForm><StudentSubmissionFlow classId="class" project={project} onSaved={vi.fn()} step={2} onStepChange={vi.fn()} /></GuardedForm>);
    expect(await screen.findByLabelText('能力或經歷標題')).toHaveValue(project.title);
    expect(screen.getByLabelText('我做了甚麼')).toHaveValue('');
  });
  it('keeps submitted student cards readable without draft editing controls', async () => {
    vi.mocked(listSkills).mockResolvedValue({ skills: [{
      id: 'submitted-skill', projectId: project.id, title: 'Teamwork', context: '', role: 'Coordinator', actions: 'Organised tasks',
      outcome: '', reflection: 'I learned to listen', summary: '', tags: [], visibility: 'private', evidence: [], status: 'submitted', revision: 3,
    }] });
    render(<GuardedForm><SkillPortfolio projectId={project.id} teacher={false} readOnly /></GuardedForm>);
    expect(await screen.findByText('Teamwork')).toBeVisible();
    expect(screen.getByRole('button', { name: 'AI 建議紀錄' })).toBeVisible();
    expect(screen.queryByRole('button', { name: '新增能力卡' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '儲存能力卡' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '編輯' })).not.toBeInTheDocument();
  });
  it('renders project text as text and links only provided public galleries', () => {
    render(<MemoryRouter><PublicProjectCard project={{ ...project, title: '<script>alert(1)</script>', galleryId: 'public-gallery', reviews: [] }} /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: '<script>alert(1)</script>' })).toBeVisible();
    expect(document.querySelector('script')).toBeNull();
    expect(screen.getByRole('link', { name: '進入 3D 展覽' })).toHaveAttribute('href', '/exhibitions/public-gallery');
  });
  it('shows approved public skill content with its source on the 2D project page', () => {
    render(<MemoryRouter><PublicProjectCard project={{ ...project, skills: [{
      id: 'skill-1', title: 'Community organising', context: 'School event', role: 'Coordinator',
      actions: 'I scheduled volunteers', outcome: 'Event completed', reflection: 'I learned to delegate',
      summary: 'Coordinated volunteers for a school event.', tags: ['planning'],
      status: 'approved', evidence: [{ id: 'source-1', kind: 'link', label: 'Event record', source: 'School',
        visibility: 'public', url: 'https://example.com/event' }],
    }] }} /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Community organising' })).toBeVisible();
    expect(screen.getByText('Coordinated volunteers for a school event.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Event record' })).toHaveAttribute('href', 'https://example.com/event');
    expect(screen.queryByRole('link', { name: '以 3D 探索能力' })).not.toBeInTheDocument();
  });
  it('opens approved skills in the linked exhibition room with release context', () => {
    render(<MemoryRouter><PublicProjectCard project={{ ...project, galleryId: 'room-1', skills: [{
      id: 'skill-1', title: 'Planning', context: '', role: '', actions: 'Organised tasks', outcome: '',
      reflection: '', summary: '', tags: [], status: 'approved', evidence: [],
    }] }} token="release-1" /></MemoryRouter>);
    expect(screen.getByRole('link', { name: '以 3D 探索能力' })).toHaveAttribute('href',
      '/exhibitions/room-1?graduation=release-1&project=project');
  });
});
