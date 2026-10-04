import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router';
import { I18nProvider } from './I18nProvider';
import { Footer } from './Footer';

afterEach(() => cleanup());

describe('footer exhibition links', () => {
  it('promotes demo and published exhibitions without a CV entry', () => {
    const { container } = render(<MemoryRouter><I18nProvider><Footer /></I18nProvider></MemoryRouter>);

    expect(container.querySelector('a[href="/demo"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="/exhibitions"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="/cv"]')).not.toBeInTheDocument();
  });
});
