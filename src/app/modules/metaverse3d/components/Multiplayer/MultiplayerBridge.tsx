import { useEffect, useRef } from "react";
import { useStore } from "../../store/useStore";
import { useLocalPlayerStore } from "../../network/localPlayerStore";
import { useMultiplayerStore } from "../../network/multiplayerStore";
import {
  connectMultiplayer,
  disconnectMultiplayer,
  emitPlayerMove,
  joinCurrentRoom,
  emitSceneSync,
  emitSceneOp,
  emitSceneFocus,
  emitSceneRequestSync,
} from "../../network/socketClient";
import { useRenderPerformanceProfile } from "../../performanceProfile";
import type { ExhibitItem } from "../../types";
import type { SceneOpEnvelope, SceneSnapshot } from "../../network/protocol";
import { rebaseLocalScene } from "../../network/rebaseLocalScene";
import { startSceneDeliveryMonitor, useSceneDeliveryStore } from "../../network/sceneDeliveryMonitor";
import { clearReconnectDraft, isReconnectReviewPending, useReconnectDraftStore } from "../../network/reconnectDraftStore";
import { loadAuth, subscribeAuth } from "@/app/api/auth";
import { isEditorTabDraftPending, useEditorTabDraftStore } from '@/app/utils/editorTabDraft';

export function MultiplayerBridge({
  targetRoomId,
  initialScene,
}: {
  targetRoomId?: string;
  initialScene?: SceneSnapshot;
}) {
  const mode = useStore((state) => state.mode);
  const exportScene = useStore((state) => state.exportScene);
  const importScene = useStore((state) => state.importScene);
  const enabled = useMultiplayerStore((state) => state.enabled);
  const setEnabled = useMultiplayerStore((state) => state.setEnabled);
  const connected = useMultiplayerStore((state) => state.connected);
  const roomId = useMultiplayerStore((state) => state.roomId);
  const setRoomId = useMultiplayerStore((state) => state.setRoomId);
  const nickname = useMultiplayerStore((state) => state.nickname);
  const shareToken = useMultiplayerStore((state) => state.shareToken);
  const role = useMultiplayerStore((state) => state.role);
  const canEditMultiplayer = role === "editor" || role === "owner";
  const sceneSyncPayload = useMultiplayerStore((state) => state.sceneSyncPayload);
  const setSceneSyncPayload = useMultiplayerStore((state) => state.setSceneSyncPayload);
  const sceneResyncRequested = useMultiplayerStore((state) => state.sceneResyncRequested);
  const sceneResyncEpoch = useMultiplayerStore((state) => state.sceneResyncEpoch);
  const sceneRecoveryRequested = useMultiplayerStore(
    (state) => state.sceneRecoveryRequested,
  );
  const sceneRecoveryInFlightId = useMultiplayerStore(
    (state) => state.sceneRecoveryInFlightId,
  );
  const sceneRecoveryAttempts = useMultiplayerStore(
    (state) => state.sceneRecoveryAttempts,
  );
  const pendingSceneOpCount = useMultiplayerStore((state) => state.pendingSceneOpIds.length);
  const beginSceneRecoverySync = useMultiplayerStore(
    (state) => state.beginSceneRecoverySync,
  );
  const setRoomError = useMultiplayerStore((state) => state.setRoomError);
  const sceneOpPayloads = useMultiplayerStore((state) => state.sceneOpPayloads);
  const dequeueSceneOpPayload = useMultiplayerStore((state) => state.dequeueSceneOpPayload);
  const sceneOpAckPayload = useMultiplayerStore((state) => state.sceneOpAckPayload);
  const setSceneOpAckPayload = useMultiplayerStore((state) => state.setSceneOpAckPayload);
  const sceneFocusPayload = useMultiplayerStore((state) => state.sceneFocusPayload);
  const setSceneFocusPayload = useMultiplayerStore((state) => state.setSceneFocusPayload);
  const upsertRemoteEditorFocus = useMultiplayerStore((state) => state.upsertRemoteEditorFocus);
  const clearRemoteEditorFocusByEditor = useMultiplayerStore((state) => state.clearRemoteEditorFocusByEditor);
  const pruneRemoteEditorFocuses = useMultiplayerStore((state) => state.pruneRemoteEditorFocuses);
  const selectedItemId = useStore((state) => state.selectedItemId);
  const performanceProfile = useRenderPerformanceProfile();

  const lastSceneRef = useRef<SceneSnapshot | null>(null);
  const initialSceneRef = useRef(initialScene);
  const applyingRemoteRef = useRef(false);
  const pendingOpsRef = useRef<Set<string>>(new Set());
  const requestedResyncEpochRef = useRef<number | null>(null);
  const recoverySequenceRef = useRef(0);
  const unconfirmedBaseRef = useRef<SceneSnapshot | null>(null);
  const reconnectDecision = useReconnectDraftStore(state => state.decision);
  const reconnectPending = useReconnectDraftStore(state => Boolean(state.draft));
  const tabDraftPending = useEditorTabDraftStore(state => Boolean(state.pending));

  useEffect(() => startSceneDeliveryMonitor(), []);

  useEffect(() => {
    let account = loadAuth().user?.id ?? null;
    const unsubscribeAuth = subscribeAuth(() => {
      const next = loadAuth().user?.id ?? null;
      if (next !== account) {
        account = next; clearReconnectDraft(); lastSceneRef.current = null; initialSceneRef.current = undefined; unconfirmedBaseRef.current = null;
      }
    });
    const unsubscribe = useMultiplayerStore.subscribe((state, previous) => {
      if (state.roomId !== previous.roomId || state.shareToken !== previous.shareToken) initialSceneRef.current = undefined;
      if (state.roomId !== previous.roomId || state.shareToken !== previous.shareToken || !state.enabled) {
        clearReconnectDraft(); lastSceneRef.current = null; unconfirmedBaseRef.current = null; return;
      }
      if (!previous.connected || state.connected || !previous.enabled || isEditorTabDraftPending()) return;
      const existing = useReconnectDraftStore.getState().draft;
      if (existing) {
        useReconnectDraftStore.setState({ draft: { ...existing, remote: null }, decision: null }); return;
      }
      const studio = useStore.getState();
      if (!['edit', 'floor-plan'].includes(studio.mode) || !['editor', 'owner'].includes(previous.role || '')) return;
      const uncertain = previous.pendingSceneOpIds.length > 0 || Boolean(previous.sceneRecoveryInFlightId);
      const base = uncertain ? unconfirmedBaseRef.current || lastSceneRef.current : lastSceneRef.current;
      if (base) useReconnectDraftStore.setState({ draft: {
        roomId: previous.roomId, base: structuredClone(base), remote: null, uncertain,
      }, decision: null });
    });
    return () => { unsubscribe(); unsubscribeAuth(); clearReconnectDraft(); };
  }, []);

  useEffect(() => {
    // Saving before the first snapshot must not move this handshake's baseline.
    initialSceneRef.current ??= initialScene;
  }, [initialScene, roomId, shareToken]);

  useEffect(() => {
    const publicRoomId = targetRoomId?.trim();
    if (!publicRoomId) return;

    setRoomId(publicRoomId);
    setEnabled(true);

    return () => {
      const multiplayer = useMultiplayerStore.getState();
      if (multiplayer.roomId === publicRoomId) {
        multiplayer.setEnabled(false);
      }
    };
  }, [setEnabled, setRoomId, targetRoomId]);

  useEffect(() => {
    lastSceneRef.current = null;
    unconfirmedBaseRef.current = null;
    pendingOpsRef.current.clear();
    requestedResyncEpochRef.current = null;
  }, [roomId, connected]);

  useEffect(() => {
    if (!enabled) {
      disconnectMultiplayer();
      return;
    }

    connectMultiplayer();

    return () => {
      disconnectMultiplayer();
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !connected) return;
    joinCurrentRoom();
  }, [enabled, connected, roomId, nickname, shareToken]);

  useEffect(() => {
    if (!enabled || !connected || mode !== "view") return;

    let seq = 0;
    const interval = window.setInterval(() => {
      const local = useLocalPlayerStore.getState();
      emitPlayerMove({
        roomId,
        seq: ++seq,
        t: Date.now(),
        position: local.position,
        yaw: local.yaw,
        pose: local.pose,
        emote: local.emote,
        emoteNonce: local.emoteNonce,
      });
    }, performanceProfile.multiplayerMoveIntervalMs);

    return () => window.clearInterval(interval);
  }, [enabled, connected, mode, roomId, performanceProfile.multiplayerMoveIntervalMs]);

  useEffect(() => {
    const isCollaborativeEditMode = mode === "edit" || mode === "floor-plan";
    if (!enabled || !connected || !isCollaborativeEditMode || !canEditMultiplayer) return;

    const interval = window.setInterval(() => {
      if (
        applyingRemoteRef.current
        || useSceneDeliveryStore.getState().delayed
        || isReconnectReviewPending()
        || isEditorTabDraftPending()
        || useMultiplayerStore.getState().sceneResyncRequested
        || useMultiplayerStore.getState().sceneRecoveryRequested
        || (initialScene && useMultiplayerStore.getState().lastSceneVersion === null)
      ) return;

      const scene = exportScene();
      const previous = lastSceneRef.current;
      if (previous) {
        const previousItems = new Map(previous.items.map(item => [item.id, JSON.stringify(item)]));
        const nextIds = new Set(scene.items.map(item => item.id));
        const changedItems = scene.items.filter(item => previousItems.get(item.id) !== JSON.stringify(item)).length
          + previous.items.filter(item => !nextIds.has(item.id)).length;
        if (changedItems > 20) {
          const state = useMultiplayerStore.getState();
          // A complete generated layout is one version-checked replacement, never
          // dozens of partially accepted events competing with the rate limiter.
          if (state.pendingSceneOpIds.length || state.lastSceneVersion === null) return;
          const clientSyncId = `bulk-${Date.now()}-${++recoverySequenceRef.current}`;
          unconfirmedBaseRef.current = previous;
          useMultiplayerStore.setState({sceneRecoveryRequested:true,sceneRecoveryInFlightId:clientSyncId,sceneRecoveryAttempts:1});
          if (!emitSceneSync({roomId,scene,clientSyncId,expectedVersion:state.lastSceneVersion})) {
            useMultiplayerStore.getState().setRoomError({code:'COLLABORATION_UNAVAILABLE',message:'collaboration service is unavailable',roomId,clientSyncId});
          }
          return;
        }
      }
      if (useMultiplayerStore.getState().pendingSceneOpIds.length === 0) unconfirmedBaseRef.current = previous;
      lastSceneRef.current = scene;
      const emitTrackedSceneOp = (payload: SceneOpEnvelope) => {
        if (!emitSceneOp(payload)) return;
        pendingOpsRef.current.add(payload.clientOpId);
        useMultiplayerStore.getState().registerPendingSceneOp(payload.clientOpId);
      };

      if (!previous) {
        const expectedVersion = useMultiplayerStore.getState().lastSceneVersion;
        emitSceneSync({
          roomId,
          scene: {
            roomSize: scene.roomSize,
            items: scene.items,
            floorPlanElements: scene.floorPlanElements,
            wallMaterialOverrides: scene.wallMaterialOverrides,
          },
          ...(expectedVersion !== null ? { expectedVersion } : {}),
        });
        return;
      }

      const prevRoom = JSON.stringify(previous.roomSize);
      const nextRoom = JSON.stringify(scene.roomSize);
      if (prevRoom !== nextRoom) {
        const clientOpId = `room-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        emitTrackedSceneOp({ roomId, clientOpId, op: { kind: "set-room", roomSize: scene.roomSize } });
      }

      if (JSON.stringify(previous.floorPlanElements) !== JSON.stringify(scene.floorPlanElements)) {
        const clientOpId = `floor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        emitTrackedSceneOp({
          roomId,
          clientOpId,
          op: { kind: "set-floor-plan", floorPlanElements: scene.floorPlanElements },
        });
      }

      if (JSON.stringify(previous.wallMaterialOverrides) !== JSON.stringify(scene.wallMaterialOverrides)) {
        const clientOpId = `wall-material-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        emitTrackedSceneOp({
          roomId,
          clientOpId,
          op: {
            kind: "set-wall-material-overrides",
            wallMaterialOverrides: scene.wallMaterialOverrides,
          },
        });
      }

      const prevById = new Map(previous.items.map((item) => [item.id, item]));
      const nextById = new Map(scene.items.map((item) => [item.id, item]));

      for (const [id, nextItem] of nextById.entries()) {
        const prevItem = prevById.get(id);
        if (!prevItem) {
          const clientOpId = `add-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          emitTrackedSceneOp({ roomId, clientOpId, op: { kind: "add-item", item: nextItem } });
          continue;
        }

        if (JSON.stringify(prevItem) !== JSON.stringify(nextItem)) {
          const updates: Partial<ExhibitItem> = {};
          const keys = new Set([...Object.keys(prevItem || {}), ...Object.keys(nextItem || {})]);
          for (const key of keys) {
            if (JSON.stringify(prevItem[key as keyof ExhibitItem]) !== JSON.stringify(nextItem[key as keyof ExhibitItem])) {
              Object.assign(updates, { [key]: nextItem[key as keyof ExhibitItem] });
            }
          }

          if (Object.keys(updates).length > 0) {
            const clientOpId = `upd-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            emitTrackedSceneOp({ roomId, clientOpId, op: { kind: "update-item", id, updates } });
          }
        }
      }

      for (const [id] of prevById.entries()) {
        if (!nextById.has(id)) {
          const clientOpId = `del-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          emitTrackedSceneOp({ roomId, clientOpId, op: { kind: "remove-item", id } });
        }
      }
    }, 120);

    return () => window.clearInterval(interval);
  }, [enabled, connected, mode, roomId, exportScene, canEditMultiplayer, initialScene]);

  useEffect(() => {
    if (!sceneResyncRequested) {
      requestedResyncEpochRef.current = null;
      return;
    }
    if (
      !enabled
      || !connected
      || sceneRecoveryRequested
      || pendingSceneOpCount > 0
      || requestedResyncEpochRef.current === sceneResyncEpoch
    ) return;
    requestedResyncEpochRef.current = sceneResyncEpoch;
    emitSceneRequestSync({ roomId });
  }, [
    enabled,
    connected,
    roomId,
    sceneResyncRequested,
    sceneResyncEpoch,
    sceneRecoveryRequested,
    pendingSceneOpCount,
  ]);

  useEffect(() => {
    if (
      !enabled
      || !connected
      || !sceneRecoveryRequested
      || sceneRecoveryInFlightId
      || pendingSceneOpCount > 0
      || !canEditMultiplayer
      || sceneRecoveryAttempts >= 5
      || reconnectPending
      || tabDraftPending
    ) return;

    const delay = sceneRecoveryAttempts === 0
      ? 0
      : Math.min(4_000, 250 * (2 ** (sceneRecoveryAttempts - 1)));
    const timer = window.setTimeout(() => {
      if (isReconnectReviewPending() || isEditorTabDraftPending()) return;
      const scene = exportScene();
      const recoveryState = useMultiplayerStore.getState();
      const expectedVersion = recoveryState.roomError?.code === 'SCENE_MISSING' ? null : recoveryState.lastSceneVersion;
      const clientSyncId =
        `recovery-${Date.now()}-${++recoverySequenceRef.current}`;
      beginSceneRecoverySync(clientSyncId);
      const started = useMultiplayerStore.getState().sceneRecoveryInFlightId
        === clientSyncId;
      if (!started) return;
      pendingOpsRef.current.clear();
      lastSceneRef.current = scene;
      if (!emitSceneSync({ roomId, scene, clientSyncId, ...(expectedVersion !== null ? {expectedVersion} : {}) })) {
        setRoomError({
          code: "COLLABORATION_UNAVAILABLE",
          message: "collaboration service is unavailable",
          roomId,
          clientSyncId,
        });
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [
    enabled,
    connected,
    sceneRecoveryRequested,
    sceneRecoveryInFlightId,
    sceneRecoveryAttempts,
    pendingSceneOpCount,
    roomId,
    exportScene,
    beginSceneRecoverySync,
    setRoomError,
    canEditMultiplayer,
    reconnectPending,
    tabDraftPending,
  ]);

  useEffect(() => {
    const isCollaborativeEditMode = mode === "edit" || mode === "floor-plan";
    if (!enabled || !connected || !isCollaborativeEditMode) return;

    const timer = window.setInterval(() => {
      if (pendingOpsRef.current.size > 120) {
        pendingOpsRef.current.clear();
      }
    }, 5000);

    return () => window.clearInterval(timer);
  }, [enabled, connected, mode]);

  useEffect(() => {
    if (!sceneSyncPayload) return;
    if (sceneSyncPayload.roomId !== roomId) return;
    const isCollaborativeEditMode = mode === "edit" || mode === "floor-plan";
    if (!isCollaborativeEditMode && !isReconnectReviewPending()) return;

    const review = useReconnectDraftStore.getState().draft;
    if (review && review.roomId === roomId) {
      const unchanged = !review.uncertain && JSON.stringify(exportScene()) === JSON.stringify(review.base);
      lastSceneRef.current = sceneSyncPayload.scene;
      initialSceneRef.current = sceneSyncPayload.scene;
      if (!unchanged) {
        useReconnectDraftStore.setState({ draft: { ...review, remote: sceneSyncPayload.scene } });
        setSceneSyncPayload(null); return;
      }
      importScene(sceneSyncPayload.scene);
      clearReconnectDraft(); setSceneSyncPayload(null); return;
    }

    applyingRemoteRef.current = true;
    // The first room snapshot may arrive after a generated layout was imported.
    // Reapply edits against the saved scene, even if the route rejoined the room.
    const base = lastSceneRef.current || initialSceneRef.current;
    importScene(base && canEditMultiplayer
      ? rebaseLocalScene(base, exportScene(), sceneSyncPayload.scene)
      : sceneSyncPayload.scene);
    lastSceneRef.current = sceneSyncPayload.scene;
    initialSceneRef.current = sceneSyncPayload.scene;
    pendingOpsRef.current.clear();
    applyingRemoteRef.current = false;
    setSceneSyncPayload(null);
  }, [sceneSyncPayload, roomId, mode, importScene, setSceneSyncPayload, canEditMultiplayer, exportScene, initialScene]);

  useEffect(() => {
    const sceneOpPayload = sceneOpPayloads[0];
    if (!sceneOpPayload) return;
    if (sceneOpPayload.roomId !== roomId) return;
    const isCollaborativeEditMode = mode === "edit" || mode === "floor-plan";
    if (!isCollaborativeEditMode && !isReconnectReviewPending()) return;

    if (pendingOpsRef.current.has(sceneOpPayload.clientOpId)) {
      dequeueSceneOpPayload(sceneOpPayload.clientOpId);
      return;
    }

    const base = lastSceneRef.current || exportScene();
    const next = {
      roomSize: base.roomSize,
      items: Array.isArray(base.items) ? [...base.items] : [],
      floorPlanElements: Array.isArray(base.floorPlanElements) ? base.floorPlanElements : [],
      wallMaterialOverrides:
        base.wallMaterialOverrides && typeof base.wallMaterialOverrides === "object"
          ? base.wallMaterialOverrides
          : {},
    } satisfies SceneSnapshot;

    const { op } = sceneOpPayload;
    if (op.kind === "set-room") {
      next.roomSize = op.roomSize;
    } else if (op.kind === "set-floor-plan") {
      next.floorPlanElements = op.floorPlanElements;
    } else if (op.kind === "set-wall-material-overrides") {
      next.wallMaterialOverrides = op.wallMaterialOverrides;
    } else if (op.kind === "add-item") {
      next.items.push(op.item);
    } else if (op.kind === "update-item") {
      next.items = next.items.map((item) =>
        item?.id === op.id ? { ...item, ...(op.updates || {}) } : item,
      );
    } else if (op.kind === "remove-item") {
      next.items = next.items.filter((item) => item.id !== op.id);
    }

    const delivery = useMultiplayerStore.getState();
    if (!delivery.pendingSceneOpIds.length && !delivery.sceneResyncRequested && !delivery.sceneRecoveryRequested) {
      initialSceneRef.current = next;
    }

    const review = useReconnectDraftStore.getState().draft;
    if (review) {
      lastSceneRef.current = next;
      useReconnectDraftStore.setState({ draft: { ...review, remote: next } });
      dequeueSceneOpPayload(sceneOpPayload.clientOpId); return;
    }
    applyingRemoteRef.current = true;
    importScene(canEditMultiplayer ? rebaseLocalScene(base, exportScene(), next) : next);
    lastSceneRef.current = next;
    applyingRemoteRef.current = false;
    dequeueSceneOpPayload(sceneOpPayload.clientOpId);
  }, [sceneOpPayloads, roomId, mode, importScene, dequeueSceneOpPayload, exportScene, canEditMultiplayer]);

  useEffect(() => {
    if (!reconnectDecision || !connected) return;
    const review = useReconnectDraftStore.getState().draft;
    if (!review || review.roomId !== roomId) {
      useReconnectDraftStore.setState({ decision: null }); return;
    }
    const missing = useMultiplayerStore.getState().roomError?.code === 'SCENE_MISSING' && sceneRecoveryRequested;
    if (missing && reconnectDecision === 'merge' && canEditMultiplayer) {
      clearReconnectDraft(); return;
    }
    if (sceneOpPayloads.length || sceneSyncPayload || sceneResyncRequested) return;
    if (!review?.remote || review.roomId !== roomId || (reconnectDecision === 'merge' && !canEditMultiplayer)) {
      useReconnectDraftStore.setState({ decision: null }); return;
    }
    applyingRemoteRef.current = true;
    importScene(reconnectDecision === 'merge'
      ? rebaseLocalScene(review.base, exportScene(), review.remote) : review.remote);
    lastSceneRef.current = review.remote;
    unconfirmedBaseRef.current = null;
    pendingOpsRef.current.clear();
    applyingRemoteRef.current = false;
    clearReconnectDraft();
  }, [reconnectDecision, connected, roomId, canEditMultiplayer, exportScene, importScene, sceneOpPayloads, sceneSyncPayload, sceneResyncRequested, sceneRecoveryRequested]);

  useEffect(() => {
    if (!sceneOpAckPayload) return;
    if (sceneOpAckPayload.roomId !== roomId) return;
    pendingOpsRef.current.delete(sceneOpAckPayload.clientOpId);
    const delivery = useMultiplayerStore.getState();
    if (delivery.connected && !delivery.pendingSceneOpIds.length && !delivery.sceneResyncRequested && !delivery.sceneRecoveryRequested && lastSceneRef.current) {
      initialSceneRef.current = lastSceneRef.current;
    }
    setSceneOpAckPayload(null);
  }, [sceneOpAckPayload, roomId, setSceneOpAckPayload]);

  useEffect(() => {
    if (!enabled || !connected || mode !== "edit" || !canEditMultiplayer) return;
    const refreshFocus = () => emitSceneFocus({ roomId, itemId: selectedItemId ?? null, nickname });
    refreshFocus();
    const timer = selectedItemId ? window.setInterval(refreshFocus, 3000) : null;
    return () => {
      if (timer !== null) window.clearInterval(timer);
      emitSceneFocus({ roomId, itemId: null, nickname });
    };
  }, [enabled, connected, mode, roomId, selectedItemId, nickname, canEditMultiplayer]);

  useEffect(() => {
    if (!sceneFocusPayload) return;
    if (sceneFocusPayload.roomId !== roomId) return;

    if (sceneFocusPayload.itemId) {
      upsertRemoteEditorFocus({
        by: sceneFocusPayload.by,
        byNickname: sceneFocusPayload.nickname,
        itemId: sceneFocusPayload.itemId,
        updatedAt: sceneFocusPayload.updatedAt,
      });
    } else {
      clearRemoteEditorFocusByEditor(sceneFocusPayload.by);
    }

    setSceneFocusPayload(null);
  }, [sceneFocusPayload, roomId, setSceneFocusPayload, upsertRemoteEditorFocus, clearRemoteEditorFocusByEditor]);

  useEffect(() => {
    if (!enabled || !connected || mode !== "edit") return;

    const timer = window.setInterval(() => {
      pruneRemoteEditorFocuses(9000);
    }, 3000);

    return () => window.clearInterval(timer);
  }, [enabled, connected, mode, pruneRemoteEditorFocuses]);

  return null;
}
