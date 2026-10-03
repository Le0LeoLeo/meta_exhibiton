import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/app/components/I18nProvider';
import { graduationRequest } from '@/app/api/graduation';
import GraduationWorkspace from './GraduationWorkspace';

vi.mock('@/app/api/graduation', () => ({ graduationRequest: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('class workspace role links', () => {
  it.each(['teacher', 'student'])('focuses and scrolls to the %s form after loading the route', (role) => {
    vi.mocked(graduationRequest).mockResolvedValue({ classes: [] });
    const scroll = vi.fn();
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scroll;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });

    try {
      render(<MemoryRouter initialEntries={[`/graduation#${role}`]}><I18nProvider><GraduationWorkspace /></I18nProvider></MemoryRouter>);
      const form = document.getElementById(role);
      expect(form).toBeInstanceOf(HTMLFormElement);
      expect(form).toHaveClass('scroll-mt-24');
      expect(document.activeElement).toBe(form);
      expect(scroll).toHaveBeenCalledWith({ block: 'start' });
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView;
    }
  });
  it('shows one role at a time and pre-fills a direct student join link', () => {
    vi.mocked(graduationRequest).mockResolvedValue({ classes: [] });
    Element.prototype.scrollIntoView = vi.fn();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => { callback(0); return 1; });
    render(<MemoryRouter initialEntries={['/graduation?invite=student-code#student']}><I18nProvider><GraduationWorkspace /></I18nProvider></MemoryRouter>);
    const invite = screen.getByLabelText(/invitation code|邀請碼|邀请码/i);
    expect(invite).toHaveValue('student-code');
    expect(document.getElementById('teacher')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: /organise|教師|教师/i }));
    expect(document.getElementById('teacher')).toBeInTheDocument();
    expect(document.getElementById('student')).toBeNull();
  });
});
