import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { VisitorHelp } from './VisitorHelp';
import { I18nProvider } from '@/app/components/I18nProvider';

beforeEach(() => localStorage.setItem('metaexpo-locale', 'zh-TW'));
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });
const show = (touch = false, firstVisit = true) => render(<I18nProvider><VisitorHelp touch={touch} firstVisit={firstVisit}/></I18nProvider>);
it('shows three desktop tips once, remembers completion and supports reopening', () => {
  const view = show();
  expect(screen.getAllByRole('listitem')).toHaveLength(3);
  expect(screen.getByText(/WASD/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '知道了，收起提示' }));
  expect(screen.getByRole('button', { name: '參觀操作說明' })).toHaveFocus();
  view.unmount();
  show();
  expect(screen.getByRole('button', { name: '參觀操作說明' })).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(screen.getByRole('button', { name: '參觀操作說明' }));
  expect(screen.getAllByRole('listitem')).toHaveLength(3);
});
it('remembers touch guidance separately and uses actual joystick instructions', () => {
  localStorage.setItem('metaexb:visitor-help:v1:desktop', 'done');
  show(true);
  expect(screen.getByText(/左下角搖桿/)).toBeVisible();
  expect(screen.queryByText(/WASD/)).not.toBeInTheDocument();
});
it('stays usable when preference storage is blocked', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Got it, hide tips' }));
  expect(screen.getByRole('button', { name: 'Visitor controls' })).toHaveAttribute('aria-expanded', 'false');
});
it('does not reopen automatically while already exploring', () => {
  show(false, false);
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
});
