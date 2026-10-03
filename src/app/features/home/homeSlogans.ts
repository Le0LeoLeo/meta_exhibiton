export const homeSlogans = [
  ['homeTitle', 'homeTitleEnd'],
  ['homeSloganEcho', 'homeSloganEchoEnd'],
  ['homeSloganInspiration', 'homeSloganInspirationEnd'],
  ['homeSloganPerspective', 'homeSloganPerspectiveEnd'],
  ['homeSloganStory', 'homeSloganStoryEnd'],
  ['homeSloganMoment', 'homeSloganMomentEnd'],
] as const;

const storageKey = 'metaexpo-home-slogan';
let documentSlogan: (typeof homeSlogans)[number] | undefined;

/** One choice per document, including StrictMode/remounts and locale switches. */
export function getHomeSlogan() {
  if (typeof window === 'undefined') return homeSlogans[0];
  if (documentSlogan) return documentSlogan;
  let previous = -1;
  try {
    const stored = window.sessionStorage.getItem(storageKey);
    if (stored !== null && /^\d+$/.test(stored)) previous = Number(stored);
  } catch { /* Storage may be disabled; keep the headline available. */ }
  const candidates = homeSlogans.map((_, index) => index).filter(index => index !== previous);
  const selected = candidates[Math.floor(Math.random() * candidates.length)];
  documentSlogan = homeSlogans[selected];
  try { window.sessionStorage.setItem(storageKey, String(selected)); } catch { /* Optional persistence. */ }
  return documentSlogan;
}
