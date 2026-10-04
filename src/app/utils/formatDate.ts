// Format dates in the interface language, not the browser's system language.
// I18nProvider mirrors the active locale onto <html lang>.
function interfaceLocale() {
  return typeof document === 'undefined' ? undefined : document.documentElement.lang || undefined;
}

export function formatDateTime(value: string | number | Date) {
  return new Date(value).toLocaleString(interfaceLocale());
}

export function formatDate(value: string | number | Date) {
  return new Date(value).toLocaleDateString(interfaceLocale());
}
