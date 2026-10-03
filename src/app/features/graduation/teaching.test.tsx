import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { graduationRequest, type ClassDetail } from '@/app/api/graduation';
import { DeadlineEditor, TeachingProgress } from './TeachingProgress';
import { PublicQuestions } from './ProjectQuestions';
import { CurationEvaluationPanel } from './CurationEvaluationPanel';
import { InviteCodeCopy } from './GraduationClassPage';

vi.mock('@/app/api/graduation', () => ({ graduationRequest: vi.fn() }));
vi.mock('@/app/api/auth', () => ({ loadAuth: () => ({ token: 'synthetic' }) }));
vi.mock('@/app/components/I18nProvider', () => ({ useI18n: () => ({ locale: 'en' }) }));
beforeEach(() => { vi.mocked(graduationRequest).mockReset(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('teaching improvements', () => {
  it('lets a teacher copy the student invitation code and reports a blocked clipboard', async () => {
    const writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('blocked'));
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<InviteCodeCopy token="student-code" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy invitation code' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('student-code'));
    expect(await screen.findByRole('status')).toHaveTextContent('Invitation code copied.');
    fireEvent.click(screen.getByRole('button', { name: 'Copy invitation code' }));
    expect(await screen.findByRole('status')).toHaveTextContent('copy the invitation code manually');
  });
  it('shows missing submissions and actionable status counts', () => {
    const data = { class: { role: 'teacher' }, members: [{ name: 'One', status: null }, { name: 'Two', status: 'submitted' }], projects: [{ status: 'submitted' }] } as ClassDetail;
    const onFilter = vi.fn(); render(<TeachingProgress data={data} filter="all" onFilter={onFilter} />);
    expect(screen.getByText('Enrolled students: 2 · No project yet: 1')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Awaiting review · 1' }));
    expect(onFilter).toHaveBeenCalledWith('submitted');
  });
  it('preserves a deadline edit when another teacher session changed it', async () => {
    vi.mocked(graduationRequest).mockRejectedValue(Object.assign(new Error('Conflict test'), { code: 'REVISION_CONFLICT' }));
    render(<DeadlineEditor classroom={{ id: 'c', deadline: null } as ClassDetail['class']} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByText('Adjust submission deadline'));
    const input = screen.getByLabelText('Submission deadline (optional)');
    fireEvent.change(input, { target: { value: '2027-01-01T10:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save deadline' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('preserved');
    expect(input).toHaveValue('2027-01-01T10:00');
    expect(graduationRequest).toHaveBeenCalledWith('/classes/c/deadline', 'PATCH', expect.objectContaining({ expectedDeadline: null }));
  });
  it('keeps question text when posting fails and clears it only after success', async () => {
    vi.mocked(graduationRequest).mockResolvedValueOnce({ questions: [] }).mockRejectedValueOnce({ status: 429 }).mockResolvedValue({ questions: [] });
    render(<MemoryRouter><PublicQuestions token="release" projectId="p" /></MemoryRouter>);
    await screen.findByText('No questions yet.');
    fireEvent.change(screen.getByLabelText('Ask the author'), { target: { value: 'How was this made?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post public question' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests');
    expect(screen.getByLabelText('Ask the author')).toHaveValue('How was this made?');
    fireEvent.click(screen.getByRole('button', { name: 'Post public question' }));
    await waitFor(() => expect(screen.getByLabelText('Ask the author')).toHaveValue(''));
  });
  it('labels self-reported measurements and preserves negative time differences', async () => {
    vi.mocked(graduationRequest).mockResolvedValue({ evaluations: [{ planRevision: 2, baselineMinutes: 10, actualMinutes: 15, quality: 2, notes: 'More revision needed', createdAt: '2026-09-12' }] });
    render(<CurationEvaluationPanel classId="c" planRevision={2} />);
    expect(await screen.findByText('Manual time minus current time (minutes): -5')).toBeVisible();
    expect(screen.getByText(/Time and quality are self-reported/)).toBeVisible();
  });
});

