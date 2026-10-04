import type { GalleryVisitPayload } from '../../api/galleryVisits';

const VISITOR_KEY = 'metaexb-analytics-visitor-v1';
const SESSION_PREFIX = 'metaexb-analytics-session-v1:';
const IDLE_MS = 30 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let fallbackVisitorId: string | undefined;
const sessions = new Map<string, VisitSession>();

export type VisitSession = Omit<GalleryVisitPayload, 'mode'> & { lastActiveAt: number };

function storageRead(kind: 'localStorage' | 'sessionStorage', key: string) {
  try { return window[kind].getItem(key); } catch { return null; }
}

function storageWrite(kind: 'localStorage' | 'sessionStorage', key: string, value: string) {
  try { window[kind].setItem(key, value); } catch { /* Restricted storage uses this tab's in-memory identity. */ }
}

export function getVisitSession(galleryId: string, now = Date.now()): VisitSession {
  const storedVisitor = storageRead('localStorage', VISITOR_KEY);
  const visitorId = storedVisitor && UUID.test(storedVisitor) ? storedVisitor : (fallbackVisitorId ??= crypto.randomUUID());
  storageWrite('localStorage', VISITOR_KEY, visitorId);
  let session = sessions.get(galleryId);
  if (!session) {
    try {
      const parsed = JSON.parse(storageRead('sessionStorage', SESSION_PREFIX + galleryId) || 'null') as VisitSession | null;
      if (parsed && UUID.test(parsed.sessionId) && parsed.visitorId === visitorId
        && Number.isFinite(parsed.lastActiveAt) && Number.isFinite(parsed.activeSeconds) && parsed.activeSeconds >= 0
        && parsed.itemDwellSeconds && typeof parsed.itemDwellSeconds === 'object'
        && !Array.isArray(parsed.itemDwellSeconds)
        && Object.values(parsed.itemDwellSeconds).every(value => Number.isFinite(value) && value >= 0)) {
        session = parsed;
      }
    } catch { /* Invalid cached counters start a fresh session. */ }
  }
  if (!session || session.visitorId !== visitorId || now - session.lastActiveAt >= IDLE_MS || now < session.lastActiveAt) {
    session = { visitorId, sessionId: crypto.randomUUID(), activeSeconds: 0, itemDwellSeconds: {}, lastActiveAt: now };
  }
  sessions.set(galleryId, session);
  persistVisitSession(galleryId, session);
  return session;
}

export function persistVisitSession(galleryId: string, session: VisitSession) {
  storageWrite('sessionStorage', SESSION_PREFIX + galleryId, JSON.stringify(session));
}

export function addVisibleVisitTime(session: VisitSession, elapsedSeconds: number, itemId: string | null, now: number) {
  // A suspended tab or sleeping device must not turn its timer delay into dwell.
  const seconds = Math.max(0, Math.min(2, elapsedSeconds));
  session.activeSeconds += seconds;
  if (itemId && itemId !== '__proto__' && itemId !== 'constructor' && itemId !== 'prototype') {
    session.itemDwellSeconds[itemId] = (session.itemDwellSeconds[itemId] || 0) + seconds;
  }
  session.lastActiveAt = now;
}

export function resetVisitSessionCacheForTests() {
  sessions.clear();
  fallbackVisitorId = undefined;
}
