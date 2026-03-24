import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "../store/useStore";
import { useLocalPlayerStore } from "../network/localPlayerStore";

const LOOK_SENSITIVITY = 0.002;
const MOVE_SPEED = 5;
const EYE_HEIGHT = 2.6;

type Side = "north" | "south" | "east" | "west";

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

export function Player() {
  const mode = useStore((state) => state.mode);
  const setIsPointerLocked = useStore((state) => state.setIsPointerLocked);
  const roomSize = useStore((state) => state.roomSize);
  const items = useStore((state) => state.items);
  const floorPlanElements = useStore((state) => state.floorPlanElements);
  const viewingItem = useStore((state) => state.viewingItem);
  const canOpenViewingItem = useStore((state) => state.canOpenViewingItem);
  const openViewingItemById = useStore((state) => state.openViewingItemById);
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

  useEffect(() => {
    camera.rotation.order = "YXZ";
    if (mode === "view") {
      playerPosRef.current.set(0, EYE_HEIGHT, 5);
      yawRef.current = 0;
      pitchRef.current = 0;
      camera.position.copy(playerPosRef.current);
      camera.rotation.set(0, 0, 0);
    } else {
      if (document.pointerLockElement === gl.domElement) document.exitPointerLock();
      isLockedRef.current = false;
      setIsPointerLocked(false);
    }
  }, [mode, camera, gl, setIsPointerLocked]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (mode !== "view") return;
      switch (event.code) {
        case "ArrowUp":
        case "KeyW": moveForward.current = true; break;
        case "ArrowLeft":
        case "KeyA": moveLeft.current = true; break;
        case "ArrowDown":
        case "KeyS": moveBackward.current = true; break;
        case "ArrowRight":
        case "KeyD": moveRight.current = true; break;
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (mode !== "view") return;
      switch (event.code) {
        case "ArrowUp":
        case "KeyW": moveForward.current = false; break;
        case "ArrowLeft":
        case "KeyA": moveLeft.current = false; break;
        case "ArrowDown":
        case "KeyS": moveBackward.current = false; break;
        case "ArrowRight":
        case "KeyD": moveRight.current = false; break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [mode]);

  useEffect(() => {
    const canvas = gl.domElement;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const onCanvasClick = (event: MouseEvent) => {
      if (mode !== "view" || viewingItem) return;

      const rect = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);
      const hit = intersects.find((entry) => entry.object?.userData?.itemType === "painting");
      const itemId = hit?.object?.userData?.itemId as string | undefined;

      if (itemId && canOpenViewingItem()) {
        if (document.pointerLockElement === canvas) document.exitPointerLock();
        openViewingItemById(itemId);
        return;
      }

      if (document.pointerLockElement !== canvas && !viewingItem) {
        void canvas.requestPointerLock();
      }
    };

    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === canvas;
      isLockedRef.current = locked;
      if (locked) skipNextMouseMoveRef.current = true;
      setIsPointerLocked(locked);
    };

    const onMouseMove = (event: MouseEvent) => {
      if (mode !== "view" || !isLockedRef.current) return;
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

    canvas.addEventListener("click", onCanvasClick);
    document.addEventListener("pointerlockchange", onPointerLockChange);
    document.addEventListener("mousemove", onMouseMove);

    return () => {
      canvas.removeEventListener("click", onCanvasClick);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      document.removeEventListener("mousemove", onMouseMove);
    };
  }, [mode, gl, camera, scene, viewingItem, canOpenViewingItem, openViewingItemById, setIsPointerLocked]);

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

  const wallRaycaster = useMemo(() => new THREE.Raycaster(), []);
  const down = useMemo(() => new THREE.Vector3(0, -1, 0), []);

  const blocksBySceneWall = (x: number, z: number, playerRadius: number) => {
    const samples = [[x, z], [x + playerRadius, z], [x - playerRadius, z], [x, z + playerRadius], [x, z - playerRadius]] as const;
    for (const [sx, sz] of samples) {
      wallRaycaster.set(new THREE.Vector3(sx, roomSize.height + 2, sz), down);
      const hits = wallRaycaster.intersectObjects(scene.children, true);
      const wallHit = hits.find((h) => h.object?.userData?.blockPlayer === true);
      if (wallHit) return true;
    }
    return false;
  };

  useFrame((_, delta) => {
    if (mode !== "view") return;

    if (isLockedRef.current) {
      const forwardAmount = Number(moveForward.current) - Number(moveBackward.current);
      const sideAmount = Number(moveRight.current) - Number(moveLeft.current);

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
  });

  return null;
}
