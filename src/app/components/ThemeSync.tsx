import { useEffect } from 'react';
import { useTheme } from './ThemeProvider';

export function ThemeSync() {
  const { theme } = useTheme();

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
  }, [theme]);

  return null;
}
