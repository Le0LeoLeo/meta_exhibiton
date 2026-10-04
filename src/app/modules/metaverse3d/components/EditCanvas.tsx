import { memo, useEffect } from "react";
import { OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { MOUSE } from "three";

import { Room } from "./Room";
import { ExhibitItem } from "./ExhibitItem";
import type { RoomSize, ExhibitItem as ExhibitItemType } from "../types";
import type { SceneSnapshot } from "../store/metaverseStoreTypes";

export function getEditCameraPosition(roomSize: Pick<RoomSize, 'height' | 'length'>): [number, number, number] {
  return [
    0,
    Math.min(roomSize.height - 0.8, Math.max(2.8, roomSize.height * 0.7)),
    Math.min(6, Math.max(2, roomSize.length * 0.25)),
  ];
}

export const EDIT_MOUSE_BUTTONS = {
  LEFT: MOUSE.ROTATE,
  MIDDLE: MOUSE.PAN,
  RIGHT: MOUSE.ROTATE,
} as const;

export const EDIT_CAMERA_LIMITS = {
  minPolarAngle: 0.15,
  maxPolarAngle: Math.PI / 2 - 0.08,
  minDistance: 2,
} as const;

function EditCameraSetup({ roomSize }: { roomSize: RoomSize }) {
  const camera = useThree((state) => state.camera);
  const { height, length } = roomSize;

  useEffect(() => {
    camera.position.set(...getEditCameraPosition({ height, length }));
    camera.lookAt(0, height * 0.45, 0);
    camera.updateProjectionMatrix();
  }, [camera, height, length]);

  return null;
}

export const EditCanvas = memo(function EditCanvas({
  roomSize,
  items,
  sceneOverride,
}: {
  roomSize: RoomSize;
  items: ExhibitItemType[];
  sceneOverride?: SceneSnapshot | null;
}) {
  return (
    <>
      <EditCameraSetup roomSize={roomSize} />
      <Room sceneOverride={sceneOverride} />
      {items.map((item) => <ExhibitItem key={item.id} item={item} sceneOverride={sceneOverride} readOnly={Boolean(sceneOverride)} />)}
      <OrbitControls
        makeDefault
        target={[0, roomSize.height * 0.45, 0]}
        mouseButtons={EDIT_MOUSE_BUTTONS}
        minPolarAngle={EDIT_CAMERA_LIMITS.minPolarAngle}
        maxPolarAngle={EDIT_CAMERA_LIMITS.maxPolarAngle}
        minDistance={EDIT_CAMERA_LIMITS.minDistance}
        maxDistance={Math.max(8, Math.min(roomSize.width, roomSize.length) * 0.8)}
      />
    </>
  );
});
