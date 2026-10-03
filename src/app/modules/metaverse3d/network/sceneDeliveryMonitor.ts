import { create } from 'zustand';
import { useMultiplayerStore } from './multiplayerStore';

export const SCENE_CONFIRMATION_TIMEOUT_MS = 20_000;
export const useSceneDeliveryStore = create(() => ({ pendingCount: 0, delayed: false }));

/** Observe acknowledgements; a timeout must never settle or replay an uncertain operation. */
export function startSceneDeliveryMonitor() {
  const firstSeen = new Map<string, number>();
  let session = '';
  const publish = () => {
    const now = Date.now();
    const ages = [...firstSeen.values()].map(start => now - start);
    const next = { pendingCount: ages.filter(age => age >= 1_000).length,
      delayed: ages.some(age => age >= SCENE_CONFIRMATION_TIMEOUT_MS) };
    const previous = useSceneDeliveryStore.getState();
    if (previous.pendingCount !== next.pendingCount || previous.delayed !== next.delayed) useSceneDeliveryStore.setState(next);
  };
  const reconcile = () => {
    const state = useMultiplayerStore.getState();
    const active = state.enabled && state.connected && (state.role === 'owner' || state.role === 'editor');
    const identity = active ? `${state.roomId}:${state.selfId}` : '';
    if (identity !== session) { firstSeen.clear(); session = identity; }
    const keys = active ? [...state.pendingSceneOpIds.map(id => `op:${id}`),
      ...(state.sceneRecoveryInFlightId ? [`sync:${state.sceneRecoveryInFlightId}`] : [])] : [];
    const current = new Set(keys);
    for (const key of firstSeen.keys()) if (!current.has(key)) firstSeen.delete(key);
    for (const key of keys) if (!firstSeen.has(key)) firstSeen.set(key, Date.now());
    publish();
  };
  reconcile();
  const unsubscribe = useMultiplayerStore.subscribe((state, previous) => {
    if (state.pendingSceneOpIds !== previous.pendingSceneOpIds
      || state.sceneRecoveryInFlightId !== previous.sceneRecoveryInFlightId
      || state.roomId !== previous.roomId || state.selfId !== previous.selfId
      || state.connected !== previous.connected || state.enabled !== previous.enabled
      || state.role !== previous.role) reconcile();
  });
  const timer = window.setInterval(publish, 1_000);
  return () => {
    unsubscribe(); window.clearInterval(timer); firstSeen.clear();
    useSceneDeliveryStore.setState({ pendingCount: 0, delayed: false });
  };
}
