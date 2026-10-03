import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type MutableRefObject,
} from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "../store/useStore";
import { useLocalPlayerStore } from "../network/localPlayerStore";
import { loadAuth, requestAgentReply, requestQwenTts } from "../../../api/client";
import { TTS_ENABLED } from "../../../api/tts";
import { getAgentSceneExhibits, buildAgentReplyRequest } from "../agent/requestContext";
import {
  createPlayerInputState,
  type PlayerInputState,
} from "../input/playerInput";
import { usePlayerKeyboardInput } from '../input/usePlayerKeyboardInput';
import { useTouchControls } from '../input/useTouchControls';
import { getAvatarEyeHeight } from "../avatar/avatarEyeHeight";
import { useAvatarPreferenceStore } from "../avatar/avatarPreferenceStore";
import {
  getItemDisplayName,
  getItemInteraction,
  getSeatExitPosition,
  getSeatPose,
  type ItemInteractionDescriptor,
} from "../interaction/itemInteraction";
import {
  isRuntimeItemActive,
  useRuntimeInteractionStore,
} from "../interaction/runtimeInteractionStore";
import {
  createWorldItemColliders,
  resolvePlayerCircle,
} from "../player/itemCollision";
import { getItemBehavior } from "../items/itemBehaviorRegistry";
import { buildWallTopology, getFloorPlanCenter, getFloorPlanRoomBounds } from "../store/floorPlanGeometry";
import { getWallColliders } from "../player/wallCollision";
import { getVisitorSpawn } from '../player/visitorSpawn';

const LOOK_SENSITIVITY = 0.002;
const MOVE_SPEED = 5;
const AUTO_INTRO_DISTANCE = 2.4;
const REMINDER_OUTSIDE_RANGE_MS = 60000;

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

export function Player({
  allowMotion: sceneAllowMotion = true,
  input,
  onNearbyInteractionChange,
}: {
  allowMotion?: boolean;
  input?: MutableRefObject<PlayerInputState>;
  onNearbyInteractionChange?: (
    descriptor: ItemInteractionDescriptor | null,
  ) => void;
}) {
  const mode = useStore((state) => state.mode);
  const touchControls = useTouchControls();
  const setIsPointerLocked = useStore((state) => state.setIsPointerLocked);
  const roomSize = useStore((state) => state.roomSize);
  const items = useStore((state) => state.items);
  const floorPlanElements = useStore((state) => state.floorPlanElements);
  const viewingItem = useStore((state) => state.viewingItem);
  const isChatOpen = useStore((state) => state.agent.isChatOpen);
  const hasSelectedParticipationMode = useStore((state) => state.hasSelectedParticipationMode);
  const allowPointerLock = useStore((state) => state.allowPointerLock);
  // Block player input, but let the guide keep moving while its panel is open.
  const allowMotion = sceneAllowMotion && hasSelectedParticipationMode && allowPointerLock && !isChatOpen && !viewingItem;
  const setViewingItem = useStore((state) => state.setViewingItem);
  const personality = useStore((state) => state.agent.personality);
  const setLocalTransform = useLocalPlayerStore((state) => state.setTransform);
  const entranceRevision = useLocalPlayerStore((state) => state.entranceRevision);
  const avatarAppearance = useAvatarPreferenceStore(
    (state) => state.savedAppearance,
  );
  const eyeHeight = useMemo(
    () => getAvatarEyeHeight(avatarAppearance),
    [avatarAppearance],
  );
  const seatedItemId = useRuntimeInteractionStore(
    (state) => state.seatedItemId,
  );
  const activeByItemId = useRuntimeInteractionStore(
    (state) => state.activeByItemId,
  );
  const setSeatedItemId = useRuntimeInteractionStore(
    (state) => state.setSeatedItemId,
  );
  const toggleRuntimeItem = useRuntimeInteractionStore(
    (state) => state.toggleItem,
  );
  const wallThickness = Math.max(0.12, roomSize.wallThickness);

  const roomBounds = useMemo(
    () => getFloorPlanRoomBounds(floorPlanElements, roomSize.width, roomSize.length),
    [floorPlanElements, roomSize.width, roomSize.length],
  );
  const floorPlanCenter = useMemo(() => getFloorPlanCenter(roomBounds), [roomBounds]);
  const wallColliders = useMemo(
    () => getWallColliders(
      buildWallTopology(roomBounds, roomSize.height, wallThickness, floorPlanCenter),
      eyeHeight + 0.15,
    ),
    [roomBounds, roomSize.height, wallThickness, floorPlanCenter, eyeHeight],
  );

  const { camera, gl } = useThree();
  const playerPosRef = useRef(new THREE.Vector3());
  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const isLockedRef = useRef(false);
  const skipNextMouseMoveRef = useRef(false);
  const moveForward = useRef(false);
  const moveBackward = useRef(false);
  const moveLeft = useRef(false);
  const moveRight = useRef(false);
  const nearbyItemIdRef = useRef<string | null>(null);
  const nearbyDescriptorRef = useRef<ItemInteractionDescriptor | null>(null);
  const nearbyItemEnteredAtRef = useRef<number | null>(null);
  const outsideRangeEnteredAtRef = useRef<number | null>(null);
  const lastReminderAtRef = useRef(0);
  const introRequestIdRef = useRef(0);
  const proximityRingRef = useRef<THREE.Mesh>(null);
  const fallbackInputRef = useRef(createPlayerInputState());
  const inputRef = input ?? fallbackInputRef;
  const publishNearbyInteraction = useCallback(
    (descriptor: ItemInteractionDescriptor | null) => {
      const previous = nearbyDescriptorRef.current;
      if (
        previous?.id === descriptor?.id &&
        previous?.kind === descriptor?.kind &&
        previous?.prompt === descriptor?.prompt
      ) {
        return;
      }
      nearbyDescriptorRef.current = descriptor;
      onNearbyInteractionChange?.(descriptor);
    },
    [onNearbyInteractionChange],
  );

  useEffect(() => {
    if (allowMotion) return;
    if (document.pointerLockElement === gl.domElement) document.exitPointerLock();
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
    publishNearbyInteraction(null);
  }, [allowMotion, gl, inputRef, publishNearbyInteraction]);

  useEffect(() => {
    camera.rotation.order = "YXZ";
    if (mode === "view") {
      const scene = useStore.getState();
      const spawn = getVisitorSpawn(getFloorPlanRoomBounds(scene.floorPlanElements, scene.roomSize.width, scene.roomSize.length), scene.items, scene.roomSize.wallThickness, eyeHeight);
      playerPosRef.current.set(spawn.position.x, spawn.position.y, spawn.position.z);
      yawRef.current = spawn.yaw;
      pitchRef.current = 0;
      camera.position.copy(playerPosRef.current);
      camera.rotation.set(0, spawn.yaw, 0);
      setLocalTransform(spawn.position, spawn.yaw);
      setSeatedItemId(null);
      isLockedRef.current = false;
      skipNextMouseMoveRef.current = false;
      setIsPointerLocked(false);
      if (document.pointerLockElement) document.exitPointerLock();
    } else {
      if (document.pointerLockElement === gl.domElement) document.exitPointerLock();
      isLockedRef.current = false;
      setIsPointerLocked(false);
      setSeatedItemId(null);
    }
  }, [
    mode,
    entranceRevision,
    camera,
    eyeHeight,
    gl,
    setIsPointerLocked,
    setSeatedItemId,
    setLocalTransform,
  ]);

  usePlayerKeyboardInput(inputRef, mode === 'view' && allowMotion);

  useEffect(() => {
    if (mode !== "view") {
      nearbyItemIdRef.current = null;
      nearbyItemEnteredAtRef.current = null;
      outsideRangeEnteredAtRef.current = null;
      lastReminderAtRef.current = 0;
      introRequestIdRef.current = 0;
      if (proximityRingRef.current) proximityRingRef.current.visible = false;
      publishNearbyInteraction(null);
    }

    const canvas = gl.domElement;
    if (touchControls && document.pointerLockElement === canvas) document.exitPointerLock();
    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === canvas;
      isLockedRef.current = locked;
      if (locked) skipNextMouseMoveRef.current = true;
      setIsPointerLocked(locked);
    };

    const onCanvasClick = async () => {
      if (mode !== "view" || !allowMotion || touchControls) return;
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
  }, [
    allowMotion,
    touchControls,
    mode,
    gl,
    publishNearbyInteraction,
    setIsPointerLocked,
  ]);

  const roomExtents = useMemo(() => ({
    minX: Math.min(...roomBounds.map((b) => b.minX)) - floorPlanCenter.x,
    maxX: Math.max(...roomBounds.map((b) => b.maxX)) - floorPlanCenter.x,
    minZ: Math.min(...roomBounds.map((b) => b.minZ)) - floorPlanCenter.z,
    maxZ: Math.max(...roomBounds.map((b) => b.maxZ)) - floorPlanCenter.z,
  }), [roomBounds, floorPlanCenter]);

  const itemColliders = useMemo(
    () => createWorldItemColliders(items),
    [items],
  );

  const interactiveItems = useMemo(
    () => items.filter((item) => getItemInteraction(item) !== null),
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

    const seatedItem = seatedItemId
      ? items.find((item) => item.id === seatedItemId) ?? null
      : null;
    if (seatedItem) {
      const wantsToLeave =
        inputState.interactRequested ||
        inputState.moveX !== 0 ||
        inputState.moveY !== 0;

      if (wantsToLeave) {
        inputState.interactRequested = false;
        playerPosRef.current.fromArray(
          getSeatExitPosition(seatedItem, eyeHeight),
        );
        setSeatedItemId(null);
        publishNearbyInteraction(null);
      } else {
        const pose = getSeatPose(seatedItem);
        playerPosRef.current.fromArray(pose.position);
        yawRef.current = pose.yaw;
        camera.position.copy(playerPosRef.current);
        camera.rotation.set(pitchRef.current, yawRef.current, 0);
        setLocalTransform(
          {
            x: playerPosRef.current.x,
            y: playerPosRef.current.y,
            z: playerPosRef.current.z,
          },
          yawRef.current,
          "sitting",
        );
        publishNearbyInteraction(getItemInteraction(seatedItem, true));
        return;
      }
    } else if (seatedItemId) {
      setSeatedItemId(null);
    }

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
          // Preserve analog joystick speed; only cap overlong diagonal input.
          move.clampLength(0, 1).multiplyScalar(MOVE_SPEED * Math.min(delta, 0.05));
          playerPosRef.current.add(move);
        }

        const candidateX = Math.max(roomExtents.minX + 0.4, Math.min(roomExtents.maxX - 0.4, playerPosRef.current.x));
        const candidateZ = Math.max(roomExtents.minZ + 0.4, Math.min(roomExtents.maxZ - 0.4, playerPosRef.current.z));
        const playerRadius = 0.35;
        let resolvedX = candidateX;
        let resolvedZ = candidateZ;

        for (const collider of wallColliders) {
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

        const itemResolved = resolvePlayerCircle(
          {
            x: resolvedX,
            z: resolvedZ,
            radius: playerRadius,
            minY: 0,
            maxY: eyeHeight,
          },
          itemColliders,
        );
        playerPosRef.current.x = itemResolved.x;
        playerPosRef.current.z = itemResolved.z;
      }
    }

    playerPosRef.current.y = eyeHeight;
    camera.position.copy(playerPosRef.current);
    camera.rotation.set(pitchRef.current, yawRef.current, 0);
    setLocalTransform(
      {
        x: playerPosRef.current.x,
        y: playerPosRef.current.y,
        z: playerPosRef.current.z,
      },
      yawRef.current,
      "standing",
    );

    if (viewingItem) {
      nearbyItemIdRef.current = null;
      nearbyItemEnteredAtRef.current = null;
      outsideRangeEnteredAtRef.current = null;
      publishNearbyInteraction(null);
      return;
    }

    const playerPosition = playerPosRef.current;
    const nearestItem = interactiveItems
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
      publishNearbyInteraction(null);
      if (proximityRingRef.current) proximityRingRef.current.visible = false;
      return;
    }

    const radius = getItemFootprintRadius(nearestItem.item);
    const effectiveDistance = Math.max(0, nearestItem.distance - radius);
    const interactionRange =
      getItemBehavior(nearestItem.item.type).interaction?.range ??
      AUTO_INTRO_DISTANCE;
    const inIntroRange = effectiveDistance <= interactionRange;

    if (inIntroRange) {
      nearbyItemIdRef.current = nearestItem.item.id;
      nearbyItemEnteredAtRef.current = now;
      outsideRangeEnteredAtRef.current = null;
      const defaultActive =
        getItemInteraction(nearestItem.item)?.defaultActive ?? false;
      const interaction = getItemInteraction(
        nearestItem.item,
        isRuntimeItemActive(
          activeByItemId,
          nearestItem.item.id,
          defaultActive,
        ),
      );
      publishNearbyInteraction(interaction);
      if (inputState.interactRequested) {
        inputState.interactRequested = false;
        if (interaction?.kind === "sit") {
          setSeatedItemId(nearestItem.item.id);
        } else if (
          interaction?.kind === "toggle-light" ||
          interaction?.kind === "toggle-open" ||
          interaction?.kind === "toggle-motion"
        ) {
          toggleRuntimeItem(
            nearestItem.item.id,
            interaction.defaultActive,
          );
        } else if (interaction?.kind === "view") {
          setViewingItem(nearestItem.item);
        }
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

    // The dwell reminder is spoken only, so skip it (and its AI call) while TTS is paused.
    if (!TTS_ENABLED) return;
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
