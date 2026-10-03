import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useMultiplayerStore } from './multiplayerStore';
import { startSceneDeliveryMonitor, useSceneDeliveryStore } from './sceneDeliveryMonitor';

let stop: () => void;
beforeEach(() => {
  vi.useFakeTimers();
  useMultiplayerStore.getState().clearSession();
  useMultiplayerStore.setState({ enabled: true, connected: true, roomId: 'a', selfId: 'self', role: 'owner', lastSceneVersion: 1 });
  stop = startSceneDeliveryMonitor();
});
afterEach(() => { stop(); useMultiplayerStore.getState().clearSession(); vi.useRealTimers(); });

it('keeps the original deadline when newer edits arrive and preserves uncertain operation IDs', () => {
  useMultiplayerStore.getState().registerPendingSceneOp('old');
  vi.advanceTimersByTime(19_000);
  useMultiplayerStore.getState().registerPendingSceneOp('new');
  vi.advanceTimersByTime(1_000);
  expect(useSceneDeliveryStore.getState()).toEqual({ pendingCount: 2, delayed: true });
  expect(useMultiplayerStore.getState().pendingSceneOpIds).toEqual(['old', 'new']);
  useMultiplayerStore.getState().setSceneOpAckPayload({ roomId: 'a', clientOpId: 'old', version: 2, updatedAt: 1 });
  expect(useSceneDeliveryStore.getState().delayed).toBe(false);
  expect(useMultiplayerStore.getState().pendingSceneOpIds).toEqual(['new']);
});
it('ignores cross-room acknowledgements and removes the indicator after confirmation', () => {
  useMultiplayerStore.getState().registerPendingSceneOp('edit');
  vi.advanceTimersByTime(20_000);
  useMultiplayerStore.getState().setSceneOpAckPayload({ roomId: 'other', clientOpId: 'edit', version: 2, updatedAt: 1 });
  expect(useSceneDeliveryStore.getState().delayed).toBe(true);
  useMultiplayerStore.getState().setSceneOpAckPayload({ roomId: 'a', clientOpId: 'edit', version: 2, updatedAt: 1 });
  expect(useSceneDeliveryStore.getState()).toEqual({ pendingCount: 0, delayed: false });
});
it('monitors recovery confirmations without restarting or replaying them', () => {
  useMultiplayerStore.setState({ sceneRecoveryInFlightId: 'recovery', sceneRecoveryRequested: true });
  vi.advanceTimersByTime(20_000);
  expect(useSceneDeliveryStore.getState().delayed).toBe(true);
  expect(useMultiplayerStore.getState().sceneRecoveryInFlightId).toBe('recovery');
  useMultiplayerStore.setState({ sceneRecoveryInFlightId: null });
  expect(useSceneDeliveryStore.getState().delayed).toBe(false);
});
it.each(['room', 'disconnect', 'permission', 'cleanup'])('clears timers and old-room status on %s', reason => {
  useMultiplayerStore.getState().registerPendingSceneOp('edit');
  vi.advanceTimersByTime(20_000);
  if (reason === 'room') useMultiplayerStore.getState().setRoomId('b');
  if (reason === 'disconnect') useMultiplayerStore.getState().setConnected(false);
  if (reason === 'permission') useMultiplayerStore.getState().setRole('viewer');
  if (reason === 'cleanup') stop();
  vi.advanceTimersByTime(30_000);
  expect(useSceneDeliveryStore.getState()).toEqual({ pendingCount: 0, delayed: false });
});
