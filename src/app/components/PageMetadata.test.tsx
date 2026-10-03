import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter } from 'react-router';
import { afterEach, expect, it } from 'vitest';
import { I18nProvider, useI18n } from './I18nProvider';
import { PageMetadata } from './PageMetadata';
function Controls() {
  const { setLocale } = useI18n();
  return <><button onClick={() => setLocale('en')}>English</button><Link to="/demo">Demo</Link><Link to="/">Home</Link></>;
}
afterEach(() => { cleanup(); localStorage.clear(); document.head.querySelectorAll('meta, link[rel="canonical"]').forEach(node => node.remove()); });
it('updates locale metadata and removes the homepage canonical on deep navigation', () => {
  localStorage.setItem('metaexpo-locale', 'zh-TW');
  render(<MemoryRouter><I18nProvider><PageMetadata/><Controls/></I18nProvider></MemoryRouter>);
  expect(document.title).toContain('3D 學習展覽');
  expect(document.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
  fireEvent.click(screen.getByText('English'));
  expect(document.title).toContain('3D Learning Exhibitions');
  expect(document.querySelector('meta[name="description"]')).toHaveAttribute('content', expect.stringContaining('AI-assisted reflection, teacher review'));
  fireEvent.click(screen.getByText('Demo'));
  expect(document.querySelector('link[rel="canonical"]')).toBeNull();
  expect(document.querySelector('meta[property="og:url"]')).toBeNull();
  fireEvent.click(screen.getByText('Home'));
  expect(document.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
});
