import { recordJourney, useJourneyStep } from '../journey-analytics/journey';
import { createContext, useCallback, useEffect, useRef } from 'react';
import { recordGalleryVisit } from '../../api/galleryVisits';
import { addVisibleVisitTime, getVisitSession, persistVisitSession } from './visitSession';

export const GalleryVisitFocusContext = createContext<((itemId: string | null) => void) | null>(null);

export function useGalleryVisit({ galleryId, mode, enabled, shareToken }: {
  galleryId: string;
  mode: '2d' | '3d';
  enabled: boolean;
  shareToken?: string;
}) {
  useJourneyStep('gallery_enter', enabled && Boolean(galleryId));
  const focus = useRef<string | null>(null);
  const currentMode = useRef(mode);
  currentMode.current = mode;
  const setFocusedItem = useCallback((itemId: string | null) => { focus.current = itemId; if (itemId && enabled) recordJourney('artwork_view'); }, [enabled]);

  useEffect(() => {
    if (!enabled || !galleryId) return;
    let session = getVisitSession(galleryId);
    let lastTick = Date.now();
    let visible = document.visibilityState === 'visible';
    let tickCount = 0;
    let lastSuccessfulPayload = '';
    let hasBeenVisible = visible;

    const send = (keepalive = false) => {
      if (!hasBeenVisible) return;
      const payload = {
        visitorId: session.visitorId, sessionId: session.sessionId,
        mode: currentMode.current, activeSeconds: session.activeSeconds,
        itemDwellSeconds: { ...session.itemDwellSeconds },
      };
      const serialized = JSON.stringify(payload);
      if (serialized === lastSuccessfulPayload) return;
      void recordGalleryVisit(galleryId, payload, shareToken, keepalive)
        .then(() => { lastSuccessfulPayload = serialized; })
        .catch(() => { /* The next cumulative heartbeat retries without double-counting. */ });
    };
    const tick = () => {
      const now = Date.now();
      if (visible) {
        const nextSession = getVisitSession(galleryId, now);
        if (nextSession !== session) {
          session = nextSession;
          send(); // Establish a server timestamp before accumulating a new visit.
        }
        addVisibleVisitTime(session, (now - lastTick) / 1000, focus.current, now);
        persistVisitSession(galleryId, session);
      }
      lastTick = now;
    };
    const onVisibility = () => {
      tick();
      visible = document.visibilityState === 'visible';
      if (!visible) send(true);
      else {
        hasBeenVisible = true;
        session = getVisitSession(galleryId);
        send();
      }
    };
    const onPageHide = () => { tick(); send(true); visible = false; };
    const onPageShow = () => { visible = document.visibilityState === 'visible'; lastTick = Date.now(); session = getVisitSession(galleryId); if (visible) { hasBeenVisible = true; send(); } };
    if (visible) send();
    const timer = window.setInterval(() => { tick(); if (++tickCount % 15 === 0 && visible) send(); }, 1000);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      tick();
      send(true);
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      focus.current = null;
    };
  }, [enabled, galleryId, shareToken]);

  return setFocusedItem;
}
