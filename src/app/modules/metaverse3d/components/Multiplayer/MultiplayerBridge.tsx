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
} from "../../network/socketClient";

export function MultiplayerBridge() {
  const mode = useStore((state) => state.mode);
  const exportScene = useStore((state) => state.exportScene);
  const importScene = useStore((state) => state.importScene);
  const enabled = useMultiplayerStore((state) => state.enabled);
  const connected = useMultiplayerStore((state) => state.connected);
  const roomId = useMultiplayerStore((state) => state.roomId);
  const nickname = useMultiplayerStore((state) => state.nickname);
  const isHost = useMultiplayerStore((state) => state.isHost);
  const sceneSyncPayload = useMultiplayerStore((state) => state.sceneSyncPayload);
  const setSceneSyncPayload = useMultiplayerStore((state) => state.setSceneSyncPayload);
  const sceneOpPayload = useMultiplayerStore((state) => state.sceneOpPayload);
  const setSceneOpPayload = useMultiplayerStore((state) => state.setSceneOpPayload);
  const sceneOpAckPayload = useMultiplayerStore((state) => state.sceneOpAckPayload);
  const setSceneOpAckPayload = useMultiplayerStore((state) => state.setSceneOpAckPayload);
  const sceneFocusPayload = useMultiplayerStore((state) => state.sceneFocusPayload);
  const setSceneFocusPayload = useMultiplayerStore((state) => state.setSceneFocusPayload);
  const upsertRemoteEditorFocus = useMultiplayerStore((state) => state.upsertRemoteEditorFocus);
  const clearRemoteEditorFocusByEditor = useMultiplayerStore((state) => state.clearRemoteEditorFocusByEditor);
  const pruneRemoteEditorFocuses = useMultiplayerStore((state) => state.pruneRemoteEditorFocuses);
  const selectedItemId = useStore((state) => state.selectedItemId);

  const lastSceneRef = useRef<any | null>(null);
  const applyingRemoteRef = useRef(false);
  const pendingOpsRef = useRef<Set<string>>(new Set());

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
  }, [enabled, connected, roomId, nickname]);

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
      });
    }, 80);

    return () => window.clearInterval(interval);
  }, [enabled, connected, mode, roomId]);

  useEffect(() => {
    const isCollaborativeEditMode = mode === "edit" || mode === "floor-plan";
    if (!enabled || !connected || !isCollaborativeEditMode) return;

    const interval = window.setInterval(() => {
      if (applyingRemoteRef.current) return;

      const scene = exportScene();
      const previous = lastSceneRef.current;
      lastSceneRef.current = scene;

      if (!previous) {
        emitSceneSync({
          roomId,
          scene: {
            roomSize: scene.roomSize,
            items: scene.items,
            floorPlanElements: scene.floorPlanElements,
            wallMaterialOverrides: scene.wallMaterialOverrides,
          },
        });
        return;
      }

      const prevRoom = JSON.stringify(previous.roomSize);
      const nextRoom = JSON.stringify(scene.roomSize);
      if (prevRoom !== nextRoom) {
        const clientOpId = `room-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        pendingOpsRef.current.add(clientOpId);
        emitSceneOp({ roomId, clientOpId, op: { kind: "set-room", roomSize: scene.roomSize } });
      }

      const prevById = new Map((previous.items || []).map((item: any) => [item.id, item]));
      const nextById = new Map((scene.items || []).map((item: any) => [item.id, item]));

      for (const [id, nextItem] of nextById.entries()) {
        const prevItem = prevById.get(id);
        if (!prevItem) {
          const clientOpId = `add-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          pendingOpsRef.current.add(clientOpId);
          emitSceneOp({ roomId, clientOpId, op: { kind: "add-item", item: nextItem } });
          continue;
        }

        if (JSON.stringify(prevItem) !== JSON.stringify(nextItem)) {
          const updates: Record<string, any> = {};
          const keys = new Set([...Object.keys(prevItem || {}), ...Object.keys(nextItem || {})]);
          for (const key of keys) {
            if (JSON.stringify(prevItem?.[key]) !== JSON.stringify(nextItem?.[key])) {
              updates[key] = nextItem?.[key];
            }
          }

          if (Object.keys(updates).length > 0) {
            const clientOpId = `upd-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            pendingOpsRef.current.add(clientOpId);
            emitSceneOp({ roomId, clientOpId, op: { kind: "update-item", id, updates } });
          }
        }
      }

      for (const [id] of prevById.entries()) {
        if (!nextById.has(id)) {
          const clientOpId = `del-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          pendingOpsRef.current.add(clientOpId);
          emitSceneOp({ roomId, clientOpId, op: { kind: "remove-item", id } });
        }
      }
    }, 120);

    return () => window.clearInterval(interval);
  }, [enabled, connected, mode, roomId, exportScene, isHost]);

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
    if (!isCollaborativeEditMode) return;

    applyingRemoteRef.current = true;
    importScene(sceneSyncPayload.scene as any);
    lastSceneRef.current = sceneSyncPayload.scene;
    applyingRemoteRef.current = false;
    setSceneSyncPayload(null);
  }, [sceneSyncPayload, roomId, mode, importScene, setSceneSyncPayload]);

  useEffect(() => {
    if (!sceneOpPayload) return;
    if (sceneOpPayload.roomId !== roomId) return;
    const isCollaborativeEditMode = mode === "edit" || mode === "floor-plan";
    if (!isCollaborativeEditMode) return;

    if (pendingOpsRef.current.has(sceneOpPayload.clientOpId)) {
      setSceneOpPayload(null);
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
    } as any;

    const { op } = sceneOpPayload;
    if (op.kind === "set-room") {
      next.roomSize = op.roomSize;
    } else if (op.kind === "add-item") {
      next.items.push(op.item);
    } else if (op.kind === "update-item") {
      next.items = next.items.map((item: any) =>
        item?.id === op.id ? { ...item, ...(op.updates || {}) } : item,
      );
    } else if (op.kind === "remove-item") {
      next.items = next.items.filter((item: any) => item?.id !== op.id);
    }

    applyingRemoteRef.current = true;
    importScene(next);
    lastSceneRef.current = next;
    applyingRemoteRef.current = false;
    setSceneOpPayload(null);
  }, [sceneOpPayload, roomId, mode, importScene, setSceneOpPayload, exportScene]);

  useEffect(() => {
    if (!sceneOpAckPayload) return;
    if (sceneOpAckPayload.roomId !== roomId) return;
    pendingOpsRef.current.delete(sceneOpAckPayload.clientOpId);
    setSceneOpAckPayload(null);
  }, [sceneOpAckPayload, roomId, setSceneOpAckPayload]);

  useEffect(() => {
    if (!enabled || !connected || mode !== "edit") return;
    emitSceneFocus({ roomId, itemId: selectedItemId ?? null, nickname });
  }, [enabled, connected, mode, roomId, selectedItemId, nickname]);

  useEffect(() => {
    if (!sceneFocusPayload) return;
    if (sceneFocusPayload.roomId !== roomId) return;

    if (sceneFocusPayload.itemId) {
      upsertRemoteEditorFocus({
        by: sceneFocusPayload.by,
        byNickname: (sceneFocusPayload as any).nickname,
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
