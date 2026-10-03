import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SkillEvidence } from '@/app/api/skills';
import { AiDecisionReflection } from './AiDecisionReflection';

const evidence: SkillEvidence[] = [{ id: 'evidence-a', kind: 'text', label: 'Work log', source: 'Student', content: 'Grouped survey responses.', visibility: 'private' }];

describe('AI decision reflection', () => {
  it('collects a reason and the sources the student checked', () => {
    const onChange = vi.fn();
    render(<AiDecisionReflection locale="en" value={{ reason: '', checkedEvidenceIds: [] }} onChange={onChange} evidence={evidence} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Why did you make this decision?' }), { target: { value: 'The work log supports the smaller claim.' } });
    expect(onChange).toHaveBeenCalledWith({ reason: 'The work log supports the smaller claim.', checkedEvidenceIds: [] });
    fireEvent.click(screen.getByRole('checkbox', { name: /Work log/ }));
    expect(onChange).toHaveBeenLastCalledWith({ reason: '', checkedEvidenceIds: ['evidence-a'] });
  });
});
