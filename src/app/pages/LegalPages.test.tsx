import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { I18nProvider } from '../components/I18nProvider';
import Privacy from './Privacy';
import Terms from './Terms';

describe('public legal pages', () => {
  beforeEach(() => window.localStorage.setItem('metaexpo-locale', 'zh-TW'));
  afterEach(() => { cleanup(); window.localStorage.clear(); });

  it('discloses how Google sign-in data is handled', () => {
    render(<I18nProvider><MemoryRouter><Privacy /></MemoryRouter></I18nProvider>);

    expect(screen.getByRole('heading', { name: '隱私權政策' })).toBeInTheDocument();
    expect(screen.getByText(/Google 帳戶的唯一識別碼/)).toBeInTheDocument();
    expect(screen.getByText(/不會要求或儲存 Google OAuth 存取權杖/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '支援中心' })).toHaveAttribute('href', '/support');
  });

  it('publishes the terms of service', () => {
    render(<I18nProvider><MemoryRouter><Terms /></MemoryRouter></I18nProvider>);

    expect(screen.getByRole('heading', { name: '服務條款' })).toBeInTheDocument();
    expect(screen.getAllByText(/Google 登入/).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: '隱私權政策' })).toHaveAttribute('href', '/privacy');
  });
});
