import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, Link, Outlet, RouterProvider } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/app/components/I18nProvider';
import { UnsavedChangesProvider } from '@/app/components/UnsavedChangesProvider';
import { cvRequest, suggestCvCard, type CvCard, type CvMine, type CvProfileInput } from '@/app/api/cv';
import CvWorkspace from './CvWorkspace';

vi.mock('@/app/api/cv', () => ({ cvRequest: vi.fn(), suggestCvCard: vi.fn() }));
vi.mock('@/app/api/gallery', () => ({ getMyGalleries: vi.fn().mockResolvedValue({ galleries: [] }) }));
vi.mock('@/app/api/auth', () => ({ loadAuth: () => ({ token: 'owner' }) }));

const first: CvCard = { id: 'first', title: 'First card', context: '', role: '', actions: 'Organised an event', outcome: '', reflection: '', summary: '', tags: [], visibility: 'private', evidence: [], revision: 1, createdAt: '', updatedAt: '' };
let saved: CvMine;

beforeEach(() => {
  localStorage.setItem('metaexpo-locale', 'en');
  vi.spyOn(window, 'confirm').mockReturnValue(false);
  saved = { profile: { headline: 'Original introduction', about: '', galleryId: null, name: 'Student', token: null, publishedAt: null },
    cards: [{ ...first }, { ...first, id: 'second', title: 'Second card' }] };
  vi.mocked(cvRequest).mockReset().mockImplementation(async (path, method, body) => {
    if (path === '/me') {
      if (method === 'PUT') saved.profile = { ...saved.profile, ...body as CvProfileInput };
      return structuredClone(saved) as never;
    }
    if (path === '/cards/first' && method === 'PUT') saved.cards[0] = { ...saved.cards[0], ...body as CvCard, revision: 2 };
    return {} as never;
  });
  vi.mocked(suggestCvCard).mockReset().mockResolvedValue({ status: 'ready', runId: 'run',
    suggestions: [{ title: 'AI title', summary: 'AI summary', tags: [], evidenceIds: [] }], questions: [] });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

function mount() {
  const router = createMemoryRouter([{
    element: <I18nProvider><UnsavedChangesProvider><Link to="/away">Global navigation</Link><Outlet /></UnsavedChangesProvider></I18nProvider>,
    children: [{ path: '/', element: <CvWorkspace /> }, { path: '/away', element: <h1>Away</h1> }],
  }]);
  render(<RouterProvider router={router} />);
}
async function loaded() { await screen.findByDisplayValue('Original introduction'); }
function cardArticle(title: string) { return screen.getByRole('heading', { name: title }).closest('article')!; }
function edit(title = 'First card') { fireEvent.click(within(cardArticle(title)).getByRole('button', { name: 'Edit' })); }

it('keeps a profile draft after cancelling navigation and allows leaving after acceptance', async () => {
  mount(); await loaded();
  fireEvent.change(screen.getByLabelText('Short introduction'), { target: { value: 'Keep my introduction' } });
  fireEvent.click(screen.getByRole('link', { name: 'Global navigation' }));
  await waitFor(() => expect(window.confirm).toHaveBeenCalledOnce());
  expect(screen.getByDisplayValue('Keep my introduction')).toBeVisible();
  vi.mocked(window.confirm).mockReturnValue(true);
  fireEvent.click(screen.getByRole('link', { name: 'Global navigation' }));
  expect(await screen.findByRole('heading', { name: 'Away' })).toBeVisible();
});

it('confirms card switching without discarding the separate profile draft', async () => {
  mount(); await loaded(); edit();
  fireEvent.change(screen.getByLabelText('Short introduction'), { target: { value: 'Profile draft' } });
  fireEvent.change(screen.getByLabelText('Skill or experience'), { target: { value: 'Card draft' } });
  edit('Second card');
  expect(window.confirm).toHaveBeenCalledOnce();
  expect(screen.getByLabelText('Skill or experience')).toHaveValue('Card draft');
  vi.mocked(window.confirm).mockReturnValue(true);
  edit('Second card');
  expect(screen.getByLabelText('Skill or experience')).toHaveValue('Second card');
  expect(screen.getByLabelText('Short introduction')).toHaveValue('Profile draft');
  fireEvent.click(screen.getByRole('link', { name: 'Global navigation' }));
  await screen.findByRole('heading', { name: 'Away' });
  expect(window.confirm).toHaveBeenCalledTimes(3);
});

it('saving a card preserves unsaved profile content and its navigation protection', async () => {
  mount(); await loaded(); edit();
  fireEvent.change(screen.getByLabelText('Short introduction'), { target: { value: 'Profile draft' } });
  fireEvent.change(screen.getByLabelText('Skill or experience'), { target: { value: 'Saved card' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save card' }));
  await screen.findByText('Saved.');
  expect(screen.getByLabelText('Short introduction')).toHaveValue('Profile draft');
  fireEvent.click(screen.getByRole('link', { name: 'Global navigation' }));
  await waitFor(() => expect(window.confirm).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
  await waitFor(() => expect(cvRequest).toHaveBeenCalledWith('/me', 'PUT', expect.objectContaining({ headline: 'Profile draft' })));
  await screen.findByText('Saved.');
  fireEvent.click(screen.getByRole('link', { name: 'Global navigation' }));
  expect(await screen.findByRole('heading', { name: 'Away' })).toBeVisible();
  expect(window.confirm).toHaveBeenCalledOnce();
});

it('saving a profile retains an unfinished evidence source in the card editor', async () => {
  mount(); await loaded();
  fireEvent.click(screen.getByRole('button', { name: 'Add source' }));
  fireEvent.change(screen.getByLabelText('Content'), { target: { value: 'Unfinished evidence' } });
  fireEvent.change(screen.getByLabelText('Short introduction'), { target: { value: 'Saved introduction' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
  await screen.findByText('Saved.');
  expect(screen.getByLabelText('Content')).toHaveValue('Unfinished evidence');
  fireEvent.click(screen.getByRole('button', { name: 'Add skill card' }));
  expect(window.confirm).toHaveBeenCalledOnce();
  expect(screen.getByLabelText('Content')).toHaveValue('Unfinished evidence');
  const unload = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(unload);
  expect(unload.defaultPrevented).toBe(true);
});

it('does not apply an AI suggestion over a card draft when replacement is cancelled', async () => {
  mount(); await loaded(); edit();
  fireEvent.change(screen.getByLabelText('Skill or experience'), { target: { value: 'Keep my own claim' } });
  fireEvent.click(within(cardArticle('Second card')).getByRole('button', { name: 'Ask AI for evidence-based suggestions' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Use and edit' }));
  expect(suggestCvCard).toHaveBeenCalledWith('second');
  expect(window.confirm).toHaveBeenCalledOnce();
  expect(screen.getByLabelText('Skill or experience')).toHaveValue('Keep my own claim');
  expect(screen.getByLabelText('CV summary')).toHaveValue('');
});

it('keeps failed saves dirty and locks inputs while saving', async () => {
  let rejectSave!: (error: Error) => void;
  const pending = new Promise<never>((_, reject) => { rejectSave = reject; });
  mount(); await loaded(); edit();
  fireEvent.change(screen.getByLabelText('Skill or experience'), { target: { value: 'Unsaved card' } });
  vi.mocked(cvRequest).mockImplementationOnce(() => pending);
  fireEvent.click(screen.getByRole('button', { name: 'Save card' }));
  expect(screen.getByLabelText('Skill or experience')).toBeDisabled();
  expect(screen.getByLabelText('Short introduction')).toBeDisabled();
  rejectSave(new Error('Save unavailable'));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('link', { name: 'Global navigation' }));
  await waitFor(() => expect(window.confirm).toHaveBeenCalledOnce());
  expect(screen.getByLabelText('Skill or experience')).toHaveValue('Unsaved card');
});
