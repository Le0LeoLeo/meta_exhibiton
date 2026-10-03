import { useEffect, useSyncExternalStore } from 'react';
import { apiUrl } from '@/app/api/base';
export type JourneyStep = 'home' | 'gallery_enter' | 'artwork_view' | 'ai_use' | 'create_start' | 'image_uploaded' | 'template_selected' | 'preview_saved' | 'published';
const consentKey = 'metaexb:journey-consent:v1';
const sessionKey = 'metaexb:journey-session:v1';
const pendingKey = 'metaexb:journey-withdraw:v1';
let memoryConsent = 'unknown';
let session: { id: string; started: number; sent: JourneyStep[] } | null = null;
let queue = Promise.resolve();
let pendingWithdrawalIds: string[] = [];
const listeners = new Set<() => void>();
export function browserOptOut() { return typeof navigator !== 'undefined' && (navigator.doNotTrack === '1' || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true); }
export function consentState() {
  if (browserOptOut()) return 'blocked';
  try { return localStorage.getItem(consentKey) || memoryConsent; } catch { return memoryConsent; }
}
function notify() { for (const listener of listeners) listener(); }
const subscribe = (listener: () => void) => { listeners.add(listener); window.addEventListener('storage', listener); return () => { listeners.delete(listener); window.removeEventListener('storage', listener); }; };
export const useJourneyConsent = () => useSyncExternalStore(subscribe, consentState, () => 'unknown');
function saveSession() { try { sessionStorage.setItem(sessionKey, JSON.stringify(session)); } catch { /* Tab memory only. */ } }
function readSession() {
  if (!session) { try { const value = JSON.parse(sessionStorage.getItem(sessionKey) || 'null'); if (value && typeof value.id === 'string' && typeof value.started === 'number' && Array.isArray(value.sent)) session = value; } catch { /* No cross-device identity. */ } }
  return session;
}
async function send(path: string, body: unknown) {
  const response = await fetch(apiUrl(path), { method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('Journey request failed');
}
export function recordJourney(step: JourneyStep) {
  if (consentState() !== 'allowed') return;
  readSession();
  if (!session || Date.now() - session.started >= 30 * 60000) session = { id: crypto.randomUUID(), started: Date.now(), sent: [] };
  if (session.sent.includes(step)) return;
  const current = session;
  current.sent.push(step); saveSession();
  queue = queue.then(async () => {
    if (consentState() !== 'allowed' || session?.id !== current.id) return;
    try { await send('/api/journey/events', { sessionId: current.id, step, consent: true }); }
    catch { current.sent = current.sent.filter(s => s !== step); if (session === current) saveSession(); }
  });
}
export async function setJourneyConsent(allowed: boolean) {
  memoryConsent = allowed && !browserOptOut() ? 'allowed' : 'declined';
  try { localStorage.setItem(consentKey, memoryConsent); } catch { /* This tab's explicit choice still applies. */ }
  notify();
  if (memoryConsent === 'allowed') return;
  const old = readSession(); session = null;
  let pending: string[] = [...pendingWithdrawalIds];
  try { const parsed = JSON.parse(sessionStorage.getItem(pendingKey) || '[]'); if (Array.isArray(parsed)) pending.push(...parsed.filter(v => typeof v === 'string')); } catch { /* Ignore malformed preference. */ }
  if (old) pending.push(old.id);
  pending = [...new Set(pending)];
  pendingWithdrawalIds = pending;
  try { sessionStorage.removeItem(sessionKey); sessionStorage.setItem(pendingKey, JSON.stringify(pending)); } catch { /* Server retention still applies. */ }
  await queue;
  for (const id of pending) await send('/api/journey/withdraw', { sessionId: id });
  pendingWithdrawalIds = [];
  try { sessionStorage.removeItem(pendingKey); } catch { /* Optional preference. */ }
}
export function useJourneyStep(step: JourneyStep, enabled = true) {
  const consent = useJourneyConsent();
  useEffect(() => { if (enabled && consent === 'allowed') recordJourney(step); }, [step, enabled, consent]);
}
