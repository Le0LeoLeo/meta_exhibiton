import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it } from 'vitest';
import { ProjectDetails } from './ProjectDetails';

afterEach(cleanup);
const project = { title: 'Student project', authorName: 'Student', classId: 'class-1', researchQuestion: '', concept: '', process: '', outcome: '', team: '', supervisor: '', galleryId: 'private-gallery' };

it.each(['submitted', 'approved'])('opens %s teacher review as read-only without requiring public publication', status => {
  render(<MemoryRouter><ProjectDetails project={{ ...project, status }} publicView teacherView /></MemoryRouter>);
  expect(screen.getByRole('link')).toHaveAttribute('href', '/virtual-gallery/create?exhibitionId=private-gallery&share=view&returnTo=%2Fgraduation%2Fclasses%2Fclass-1');
});
it.each(['draft', 'returned'])('does not offer teacher preview for %s work', status => {
  render(<MemoryRouter><ProjectDetails project={{ ...project, status }} publicView teacherView /></MemoryRouter>);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
it('keeps public archive links on the public viewer', () => {
  render(<MemoryRouter><ProjectDetails project={project} publicView /></MemoryRouter>);
  expect(screen.getAllByRole('link')[0]).toHaveAttribute('href', '/exhibitions/private-gallery');
});
