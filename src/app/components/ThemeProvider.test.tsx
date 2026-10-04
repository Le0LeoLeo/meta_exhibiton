import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { ThemeProvider, useTheme } from './ThemeProvider';

function Probe() { const { theme, toggleTheme } = useTheme(); return <button onClick={toggleTheme}>{theme}</button>; }
beforeEach(() => { localStorage.clear(); document.documentElement.classList.remove('dark'); });
afterEach(() => { cleanup(); localStorage.clear(); document.documentElement.classList.remove('dark'); document.documentElement.style.colorScheme = ''; });
it('opens in the selected light museum theme and persists a visitor switch', () => {
 render(<ThemeProvider><Probe /></ThemeProvider>);
 fireEvent.click(screen.getByRole('button', { name: 'light' }));
 expect(document.documentElement).toHaveClass('dark');
 expect(localStorage.getItem('metaexpo-theme')).toBe('dark');
});
it('preserves an existing dark-mode preference', () => {
 localStorage.setItem('metaexpo-theme', 'dark');
 render(<ThemeProvider><Probe /></ThemeProvider>);
 expect(screen.getByRole('button', { name: 'dark' })).toBeInTheDocument();
});
