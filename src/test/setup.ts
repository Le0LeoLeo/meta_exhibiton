import '@testing-library/jest-dom/vitest';
import { LOCALES, loadDictionary } from '@/app/i18n/catalogs';

// Chinese catalogs load lazily in the app; preload them so components render synchronously in tests.
await Promise.all(LOCALES.map((locale) => loadDictionary(locale)));
