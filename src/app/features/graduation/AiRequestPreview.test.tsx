import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SkillCard } from '@/app/api/skills';
import { AiRequestPreview } from './AiRequestPreview';

const card: SkillCard = {
  id: 'skill-a', projectId: 'project-a', title: 'Research task', context: 'A class survey', role: 'Note taker',
  actions: 'Grouped responses', outcome: 'A summary table', reflection: 'I learned to compare answers', summary: '', tags: [],
  visibility: 'private', status: 'draft', revision: 4,
  evidence: [
    { id: 'private-note', kind: 'text', label: 'Private note', source: 'My notes', content: 'I grouped the responses.', visibility: 'private' },
    { id: 'link-source', kind: 'link', label: 'Reference', source: 'Web page', url: 'https://example.test', occurredAt: '2026-09-25', visibility: 'public' },
  ],
};

afterEach(cleanup);

describe('AI saved-input preview', () => {
  it('shows the saved reflection fields and starts with every source unselected', () => {
    render(<AiRequestPreview card={card} locale="en" selectedEvidenceIds={[]} onChange={vi.fn()} />);
    expect(screen.getByText('I learned to compare answers')).toBeVisible();
    expect(screen.getByText(/Link only — URL not sent; page not opened or read/)).toBeVisible();
    expect(screen.getByText('Recorded date: 2026-09-25')).toBeVisible();
    expect(screen.getByText('Private source')).toBeVisible();
    expect(screen.getByRole('checkbox', { name: /Private note/ })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Reference/ })).not.toBeChecked();
  });

  it('returns an explicit selection without including source text in the selection value', () => {
    const onChange = vi.fn();
    render(<AiRequestPreview card={card} locale="en" selectedEvidenceIds={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Private note/ }));
    expect(onChange).toHaveBeenCalledWith(['private-note']);
  });
});
