import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "../store/useStore";
import { useLocalPlayerStore } from "../network/localPlayerStore";
import { loadAuth, requestAgentReply, requestQwenTts } from "../../../api/client";
import { getAgentSceneExhibits, buildAgentReplyRequest } from "../agent/requestContext";
import {
  createPlayerInputState,
  setKeyboardKey,
  type PlayerInputState,
} from "../input/playerInput";

const LOOK_SENSITIVITY = 0.002;
const MOVE_SPEED = 5;
const EYE_HEIGHT = 2.6;
const AUTO_INTRO_DISTANCE = 2.4;
const REMINDER_OUTSIDE_RANGE_MS = 60000;
const AUTO_INTRO_COOLDOWN_MS = 15000;

type Side = "north" | "south" | "east" | "west";

function getItemDisplayName(item: { title?: string; fileName?: string; type?: string }) {
  return item.title?.trim() || item.fileName?.trim() || `${item.type || "展品"}`;
}

function getItemFootprintRadius(item: { type?: string; scale: [number, number, number] }) {
  const [sx, , sz] = item.scale;
  switch (item.type) {
    case "painting":
      return Math.max(0.8, Math.abs(sx) * 0.65);
    case "text":
      return Math.max(0.7, Math.abs(sx) * 0.55);
    case "pedestal":
      return Math.max(0.8, Math.abs(sx) * 0.6);
    default:
      return Math.max(0.75, Math.max(Math.abs(sx), Math.abs(sz)) * 0.55);
  }
}

function createSegments(start: number, end: number, cuts: Array<[number, number]>) {
  const normalized = cuts
    .map(([s, e]) => [Math.max(start, Math.min(s, e)), Math.min(end, Math.max(s, e))] as [number, number])
    .filter(([s, e]) => e - s > 0.05)
    .sort((a, b) => a[0] - b[0]);

  const merged: Array<[number, number]> = [];
  for (const [s, e] of normalized) {
    const last = merged[merged.length - 1];
    if (!last || s > last[1]) merged.push([s, e]);
    else last[1] = Math.max(last[1], e);
  }

  const result: Array<[number, number]> = [];
  let cursor = start;
  for (const [s, e] of merged) {
    if (s - cursor > 0.08) result.push([cursor, s]);
    cursor = Math.max(cursor, e);
  }
  if (end - cursor > 0.08) result.push([cursor, end]);
  return result;
}

export function Player({
  allowMotion = true,
  input,
  onNearbyItemChange,
}: {
  allowMotion?: boolean;
  input?: MutableRefObject<PlayerInputState>;
  onNearbyItemChange?: (title: string | null) => void;
}) {
  const mode = useStore((state) => state.mode);
  const setIsPointerLocked = useStore((state) => state.setIsPointerLocked);
  const roomSize = useStore((state) => state.roomSize);
  const items = useStore((state) => state.items);
  const floorPlanElements = useStore((state) => state.floorPlanElements);
  const viewingItem = useStore((state) => state.viewingItem);
  const setViewingItem = useStore((state) => state.setViewingItem);
  const personality = useStore((state) => state.agent.personality);
  const setAgentNearbyExhibit = useStore((state) => state.setAgentNearbyExhibit);
  const setAgentActiveExhibit = useStore((state) => state.setAgentActiveExhibit);
  const setLocalTransform = useLocalPlayerStore((state) => state.setTransform);
  const wallThickness = Math.max(0.12, roomSize.wallThickness);

  const roomBounds = useMemo(() => {
    const roomElements = floorPlanElements.filter((el) => el.type === "room");
    if (roomElements.length > 0) {
      return roomElements.map((room) => {
        const [x, , z] = room.position;
        const [sx, , sz] = room.scale;
        return {
          minX: x - Math.abs(sx) / 2,
          maxX: x + Math.abs(sx) / 2,
          minZ: z - Math.abs(sz) / 2,
          maxZ: z + Math.abs(sz) / 2,
        };
      });
    }

    return [{ minX: -roomSize.width / 2, maxX: roomSize.width / 2, minZ: -roomSize.length / 2, maxZ: roomSize.length / 2 }];
  }, [floorPlanElements, roomSize.width, roomSize.length]);

  const floorPlanWallColliders = useMemo(() => {
    const triggerGap = 0.8;
    const minOverlap = 1.2;
    const doorMaxWidth = 1.8;

    const cuts = new Map<string, Array<[number, number]>>();
    const hiddenSides = new Set<string>();
    const cutKey = (roomId: string, side: Side) => `${roomId}:${side}`;
    const pushCut = (key: string, s: number, e: number) => {
      if (!cuts.has(key)) cuts.set(key, []);
      cuts.get(key)!.push([s, e]);
    };

    const rooms = roomBounds.map((room, index) => ({ ...room, id: `room-${index}` }));

    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        const a = rooms[i];
        const b = rooms[j];

        const overlapZStart = Math.max(a.minZ, b.minZ);
        const overlapZEnd = Math.min(a.maxZ, b.maxZ);
        const overlapZ = overlapZEnd - overlapZStart;

        const overlapXStart = Math.max(a.minX, b.minX);
        const overlapXEnd = Math.min(a.maxX, b.maxX);
        const overlapX = overlapXEnd - overlapXStart;

        const gapAXtoB = b.minX - a.maxX;
        if (gapAXtoB >= 0 && gapAXtoB <= triggerGap && overlapZ >= minOverlap) {
          hiddenSides.add(cutKey(b.id, "west"));
          const centerLine = (overlapZStart + overlapZEnd) / 2;
          const width = Math.min(doorMaxWidth, overlapZ - 0.2);
          if (width > 0.6) pushCut(cutKey(a.id, "east"), centerLine - width / 2, centerLine + width / 2);
          continue;
        }

        const gapBXtoA = a.minX - b.maxX;
        if (gapBXtoA >= 0 && gapBXtoA <= triggerGap && overlapZ >= minOverlap) {
          hiddenSides.add(cutKey(a.id, "west"));
          const centerLine = (overlapZStart + overlapZEnd) / 2;
          const width = Math.min(doorMaxWidth, overlapZ - 0.2);
          if (width > 0.6) pushCut(cutKey(b.id, "east"), centerLine - width / 2, centerLine + width / 2);
          continue;
        }

        const gapAZtoB = b.minZ - a.maxZ;
        if (gapAZtoB >= 0 && gapAZtoB <= triggerGap && overlapX >= minOverlap) {
          hiddenSides.add(cutKey(b.id, "north"));
          const centerLine = (overlapXStart + overlapXEnd) / 2;
          const width = Math.min(doorMaxWidth, overlapX - 0.2);
          if (width > 0.6) pushCut(cutKey(a.id, "south"), centerLine - width / 2, centerLine + width / 2);
          continue;
        }

        const gapBZtoA = a.minZ - b.maxZ;
        if (gapBZtoA >= 0 && gapBZtoA <= triggerGap && overlapX >= minOverlap) {
          hiddenSides.add(cutKey(a.id, "north"));
          const centerLine = (overlapXStart + overlapXEnd) / 2;
          const width = Math.min(doorMaxWidth, overlapX - 0.2);
          if (width > 0.6) pushCut(cutKey(b.id, "south"), centerLine - width / 2, centerLine + width / 2);
        }
      }
    }

    const colliders: Array<{ position: [number, number, number]; rotationY: number; halfX: number; halfZ: number }> = [];

    for (const room of rooms) {
      const northKey = cutKey(room.id, "north");
      const southKey = cutKey(room.id, "south");
      const eastKey = cutKey(room.id, "east");
      const westKey = cutKey(room.id, "west");

      if (!hiddenSides.has(northKey)) {
        for (const [s, e] of createSegments(room.minX, room.maxX, cuts.get(northKey) || [])) {
          colliders.push({ position: [(s + e) / 2, 0, room.minZ], rotationY: 0, halfX: Math.max(0.05, e - s) / 2, halfZ: wallThickness / 2 });
        }
      }
      if (!hiddenSides.has(southKey)) {
        for (const [s, e] of createSegments(room.minX, room.maxX, cuts.get(southKey) || [])) {
          colliders.push({ position: [(s + e) / 2, 0, room.maxZ], rotationY: 0, halfX: Math.max(0.05, e - s) / 2, halfZ: wallThickness / 2 });
        }
      }
      if (!hiddenSides.has(eastKey)) {
        for (const [s, e] of createSegments(room.minZ, room.maxZ, cuts.get(eastKey) || [])) {
          colliders.push({ position: [room.maxX, 0, (s + e) / 2], rotationY: Math.PI / 2, halfX: Math.max(0.05, e - s) / 2, halfZ: wallThickness / 2 });
        }
      }
      if (!hiddenSides.has(westKey)) {
        for (const [s, e] of createSegments(room.minZ, room.maxZ, cuts.get(westKey) || [])) {
          colliders.push({ position: [room.minX, 0, (s + e) / 2], rotationY: Math.PI / 2, halfX: Math.max(0.05, e - s) / 2, halfZ: wallThickness / 2 });
        }
      }
    }

    return colliders;
  }, [roomBounds, wallThickness]);

  const { camera, gl, scene } = useThree();
  const playerPosRef = useRef(new THREE.Vector3(0, EYE_HEIGHT, 5));
  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const isLockedRef = useRef(false);
  const skipNextMouseMoveRef = useRef(false);
  const moveForward = useRef(false);
  const moveBackward = useRef(false);
  const moveLeft = useRef(false);
  const moveRight = useRef(false);
  const nearbyItemIdRef = useRef<string | null>(null);
  const nearbyItemEnteredAtRef = useRef<number | null>(null);
  const outsideRangeEnteredAtRef = useRef<number | null>(null);
  const lastReminderAtRef = useRef(0);
  const introRequestIdRef = useRef(0);
  const proximityRingRef = useRef<THREE.Mesh>(null);
  const fallbackInputRef = useRef(createPlayerInputState());
  const inputRef = input ?? fallbackInputRef;

  useEffect(() => {
    if (allowMotion) return;
    moveForward.current = false;
    moveBackward.current = false;
    moveLeft.current = false;
    moveRight.current = false;
    inputRef.current.moveX = 0;
    inputRef.current.moveY = 0;
    inputRef.current.lookDeltaX = 0;
    inputRef.current.lookDeltaY = 0;
    inputRef.current.interactRequested = false;
    inputRef.current.pressedKeys.clear();
    nearbyItemIdRef.current = null;
    nearbyItemEnteredAtRef.current = null;
    outsideRangeEnteredAtRef.current = null;
    if (proximityRingRef.current) proximityRingRef.current.visible = false;
    onNearbyItemChange?.(null);
  }, [allowMotion, inputRef, onNearbyItemChange]);

  useEffect(() => {
    camera.rotation.order = "YXZ";
    if (mode === "view") {
      playerPosRef.current.set(0, EYE_HEIGHT, 5);
      yawRef.current = 0;
      pitchRef.current = 0;
      camera.position.copy(playerPosRef.current);
      camera.rotation.set(0, 0, 0);
      isLockedRef.current = false;
      skipNextMouseMoveRef.current = false;
      setIsPointerLocked(false);
      if (document.pointerLockElement) document.exitPointerLock();
    } else {
      if (document.pointerLockElement === gl.domElement) document.exitPointerLock();
      isLockedRef.current = false;
      setIsPointerLocked(false);
    }
  }, [mode, camera, gl, setIsPointerLocked]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (mode !== "view" || !allowMotion) return;
      setKeyboardKey(inputRef.current, event.code, true);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (mode !== "view" || !allowMotion) return;
      setKeyboardKey(inputRef.current, event.code, false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [allowMotion, inputRef, mode]);

  useEffect(() => {
    if (mode !== "view") {
      nearbyItemIdRef.current = null;
      nearbyItemEnteredAtRef.current = null;
      outsideRangeEnteredAtRef.current = null;
      lastReminderAtRef.current = 0;
      introRequestIdRef.current = 0;
      if (proximityRingRef.current) proximityRingRef.current.visible = false;
    }

    const canvas = gl.domElement;
    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === canvas;
      isLockedRef.current = locked;
      if (locked) skipNextMouseMoveRef.current = true;
      setIsPointerLocked(locked);
    };

    const onCanvasClick = async () => {
      if (mode !== "view" || !allowMotion) return;
      if (document.pointerLockElement === canvas) return;
      try {
        if (document.pointerLockElement) document.exitPointerLock();
        await canvas.requestPointerLock();
      } catch {
        try {
          if (document.pointerLockElement) document.exitPointerLock();
          await canvas.requestPointerLock({ unadjustedMovement: true } as PointerLockOptions);
        } catch {
          // ignore browser-specific pointer lock failures
        }
      }
    };

    const onMouseMove = (event: MouseEvent) => {
      if (mode !== "view" || !allowMotion || !isLockedRef.current) return;
      if (skipNextMouseMoveRef.current) { skipNextMouseMoveRef.current = false; return; }

      const maxDelta = 120;
      const mx = Math.max(-maxDelta, Math.min(maxDelta, event.movementX));
      const my = Math.max(-maxDelta, Math.min(maxDelta, event.movementY));
      yawRef.current -= mx * LOOK_SENSITIVITY;
      pitchRef.current -= my * LOOK_SENSITIVITY;
      const minPitch = -Math.PI / 2 + 0.15;
      const maxPitch = Math.PI / 2 - 0.15;
      pitchRef.current = Math.max(minPitch, Math.min(maxPitch, pitchRef.current));
    };

    document.addEventListener("pointerlockchange", onPointerLockChange);
    canvas.addEventListener("click", onCanvasClick);
    document.addEventListener("mousemove", onMouseMove);

    return () => {
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      canvas.removeEventListener("click", onCanvasClick);
      document.removeEventListener("mousemove", onMouseMove);
    };
  }, [allowMotion, mode, gl, setIsPointerLocked]);

  const roomExtents = useMemo(() => ({
    minX: Math.min(...roomBounds.map((b) => b.minX)),
    maxX: Math.max(...roomBounds.map((b) => b.maxX)),
    minZ: Math.min(...roomBounds.map((b) => b.minZ)),
    maxZ: Math.max(...roomBounds.map((b) => b.maxZ)),
  }), [roomBounds]);

  const collidableItems = useMemo(() => items.filter((item) => item.type === "partition" || item.type === "pedestal"), [items]);

  const allColliders = useMemo(() => [
    ...floorPlanWallColliders.map((wall) => ({ position: wall.position, rotation: [0, wall.rotationY, 0] as [number, number, number], halfX: wall.halfX, halfZ: wall.halfZ })),
    ...collidableItems.map((collidable) => {
      const [sx, , sz] = collidable.scale;
      const [rx = 0, , rz = 0] = collidable.rotation;

      if (collidable.type === "partition") {
        const thicknessBoost = Math.sin(Math.abs(rx)) * Math.abs(sx) * 0.5 + Math.sin(Math.abs(rz)) * Math.abs(sz) * 0.5;
        return { position: collidable.position, rotation: collidable.rotation, halfX: (Math.abs(sx) || 1) * 0.5 + thicknessBoost, halfZ: (Math.abs(sz) || 1) * 0.5 + thicknessBoost };
      }

      const pedestalRadius = 0.6;
      return { position: collidable.position, rotation: collidable.rotation, halfX: Math.max(0.25, Math.abs(sx) * pedestalRadius), halfZ: Math.max(0.25, Math.abs(sz) * pedestalRadius) };
    }),
  ], [floorPlanWallColliders, collidableItems]);

  const _wallRaycaster = useMemo(() => new THREE.Raycaster(), []);
  const _down = useMemo(() => new THREE.Vector3(0, -1, 0), []);

  const blocksBySceneWall = (_x: number, _z: number, _playerRadius: number) => false;
  const exhibitItems = useMemo(
    () => items.filter((item) => item.type === "painting" || item.type === "pedestal" || item.type === "text" || item.type === "sculpture"),
    [items],
  );

  useFrame((_, delta) => {
    if (mode !== "view") return;
    if (!allowMotion) return;

    const inputState = inputRef.current;
    yawRef.current -= inputState.lookDeltaX * LOOK_SENSITIVITY;
    pitchRef.current -= inputState.lookDeltaY * LOOK_SENSITIVITY;
    inputState.lookDeltaX = 0;
    inputState.lookDeltaY = 0;
    const minPitch = -Math.PI / 2 + 0.15;
    const maxPitch = Math.PI / 2 - 0.15;
    pitchRef.current = Math.max(minPitch, Math.min(maxPitch, pitchRef.current));

    if (isLockedRef.current || inputState.moveX !== 0 || inputState.moveY !== 0) {
      const forwardAmount =
        inputState.moveY ||
        Number(moveForward.current) - Number(moveBackward.current);
      const sideAmount =
        inputState.moveX ||
        Number(moveRight.current) - Number(moveLeft.current);

      if (forwardAmount !== 0 || sideAmount !== 0) {
        const forward = new THREE.Vector3(-Math.sin(yawRef.current), 0, -Math.cos(yawRef.current));
        const right = new THREE.Vector3(Math.cos(yawRef.current), 0, -Math.sin(yawRef.current));
        const move = new THREE.Vector3();
        move.addScaledVector(forward, forwardAmount);
        move.addScaledVector(right, sideAmount);

        if (move.lengthSq() > 0) {
          move.normalize().multiplyScalar(MOVE_SPEED * delta);
          playerPosRef.current.add(move);
        }

        const candidateX = Math.max(roomExtents.minX + 0.4, Math.min(roomExtents.maxX - 0.4, playerPosRef.current.x));
        const candidateZ = Math.max(roomExtents.minZ + 0.4, Math.min(roomExtents.maxZ - 0.4, playerPosRef.current.z));
        const playerRadius = 0.35;
        let resolvedX = candidateX;
        let resolvedZ = candidateZ;

        for (const collider of allColliders) {
          const [px, , pz] = collider.position;
          const [, ry = 0] = collider.rotation;
          const localX = resolvedX - px;
          const localZ = resolvedZ - pz;
          const cosY = Math.cos(-ry);
          const sinY = Math.sin(-ry);
          let rotatedX = localX * cosY - localZ * sinY;
          let rotatedZ = localX * sinY + localZ * cosY;

          if (Math.abs(rotatedX) < collider.halfX + playerRadius && Math.abs(rotatedZ) < collider.halfZ + playerRadius) {
            const penX = collider.halfX + playerRadius - Math.abs(rotatedX);
            const penZ = collider.halfZ + playerRadius - Math.abs(rotatedZ);
            if (penX < penZ) rotatedX = rotatedX >= 0 ? collider.halfX + playerRadius : -(collider.halfX + playerRadius);
            else rotatedZ = rotatedZ >= 0 ? collider.halfZ + playerRadius : -(collider.halfZ + playerRadius);

            const worldCosY = Math.cos(ry);
            const worldSinY = Math.sin(ry);
            resolvedX = rotatedX * worldCosY - rotatedZ * worldSinY + px;
            resolvedZ = rotatedX * worldSinY + rotatedZ * worldCosY + pz;
          }
        }

        if (blocksBySceneWall(resolvedX, resolvedZ, playerRadius)) {
          resolvedX = playerPosRef.current.x;
          resolvedZ = playerPosRef.current.z;
        }

        playerPosRef.current.x = resolvedX;
        playerPosRef.current.z = resolvedZ;
      }
    }

    playerPosRef.current.y = EYE_HEIGHT;
    camera.position.copy(playerPosRef.current);
    camera.rotation.set(pitchRef.current, yawRef.current, 0);
    setLocalTransform({ x: playerPosRef.current.x, y: playerPosRef.current.y, z: playerPosRef.current.z }, yawRef.current);

    if (viewingItem) {
      nearbyItemIdRef.current = null;
      nearbyItemEnteredAtRef.current = null;
      outsideRangeEnteredAtRef.current = null;
      onNearbyItemChange?.(null);
      return;
    }

    const playerPosition = playerPosRef.current;
    const nearestItem = exhibitItems
      .map((item) => {
        const [x, , z] = item.position;
        const dx = playerPosition.x - x;
        const dz = playerPosition.z - z;
        const distance = Math.hypot(dx, dz);
        return { item, distance };
      })
      .sort((a, b) => a.distance - b.distance)[0] ?? null;

    const now = Date.now();
    if (!nearestItem) {
      nearbyItemIdRef.current = null;
      nearbyItemEnteredAtRef.current = null;
      outsideRangeEnteredAtRef.current = null;
      onNearbyItemChange?.(null);
      if (proximityRingRef.current) proximityRingRef.current.visible = false;
      return;
    }

    const radius = getItemFootprintRadius(nearestItem.item);
    const effectiveDistance = Math.max(0, nearestItem.distance - radius);
    const inIntroRange = effectiveDistance <= AUTO_INTRO_DISTANCE;

    if (inIntroRange) {
      nearbyItemIdRef.current = nearestItem.item.id;
      nearbyItemEnteredAtRef.current = now;
      outsideRangeEnteredAtRef.current = null;
      onNearbyItemChange?.(getItemDisplayName(nearestItem.item));
      if (inputState.interactRequested) {
        inputState.interactRequested = false;
        setViewingItem(nearestItem.item);
      }
      if (proximityRingRef.current) proximityRingRef.current.visible = false;
      return;
    }

    inputState.interactRequested = false;

    if (!outsideRangeEnteredAtRef.current || nearbyItemIdRef.current !== nearestItem.item.id) {
      nearbyItemIdRef.current = nearestItem.item.id;
      nearbyItemEnteredAtRef.current = null;
      outsideRangeEnteredAtRef.current = now;
      return;
    }

    if (now - lastReminderAtRef.current < REMINDER_OUTSIDE_RANGE_MS) return;
    const outsideElapsed = now - outsideRangeEnteredAtRef.current;
    if (outsideElapsed < REMINDER_OUTSIDE_RANGE_MS) return;

    lastReminderAtRef.current = now;
    outsideRangeEnteredAtRef.current = now;

    const displayName = getItemDisplayName(nearestItem.item);
    const promptByPersonality: Record<string, string> = {
      xiaobai: `請用親切、簡單的方式提醒使用者：他已經在 ${displayName} 附近待了一段時間，可以再靠近一點看看。不要太長。`,
      expert: `請用專業、自然的語氣提醒使用者：他已在 ${displayName} 附近停留許久，可以靠近展品欣賞細節。語氣簡潔，不要固定模板。`,
      humor: `請用幽默誇張的方式提醒使用者：他在 ${displayName} 附近站太久了，像是快要和空氣結婚一樣，可以趕快靠近一點看看。不要太長。`,
    };

    void (async () => {
      const { token } = loadAuth();
      if (!token) return;

      try {
        const payload = buildAgentReplyRequest({
          question: promptByPersonality[personality] || promptByPersonality.xiaobai,
          personality,
          exhibit: nearestItem.item,
          nearbyExhibits: getAgentSceneExhibits(items),
        });
        const result = await requestAgentReply(token, payload);
        const audio = await requestQwenTts(token, { text: result.answer });
        const url = URL.createObjectURL(audio);
        const speaker = new Audio(url);
        speaker.onended = () => URL.revokeObjectURL(url);
        await speaker.play().catch(() => undefined);
      } catch {
        const fallbackText = `${displayName}附近停留了一段時間，可以靠近一點看得更清楚。`;
        try {
          const audio = await requestQwenTts(token, { text: fallbackText });
          const url = URL.createObjectURL(audio);
          const speaker = new Audio(url);
          speaker.onended = () => URL.revokeObjectURL(url);
          await speaker.play().catch(() => undefined);
        } catch {
          // ignore reminder failures
        }
      }
    })();
  });

  return (
    <group>
      <mesh ref={proximityRingRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[AUTO_INTRO_DISTANCE - 0.08, AUTO_INTRO_DISTANCE, 64]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.22} depthWrite={false} />
      </mesh>
    </group>
  );
}
