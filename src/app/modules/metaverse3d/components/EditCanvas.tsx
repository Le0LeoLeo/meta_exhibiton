import { memo } from "react";
import { OrbitControls } from "@react-three/drei";
import { MOUSE } from "three";

import { Room } from "./Room";
import { ExhibitItem } from "./ExhibitItem";
import type { RoomSize, ExhibitItem as ExhibitItemType } from "../types";

export const EditCanvas = memo(function EditCanvas({ roomSize, items }: { roomSize: RoomSize; items: ExhibitItemType[] }) {
  return (
    <>
      <Room />
      {items.map((item) => <ExhibitItem key={item.id} item={item} />)}
      <OrbitControls makeDefault target={[0, roomSize.height * 0.45, 0]} mouseButtons={{ LEFT: MOUSE.NONE, MIDDLE: MOUSE.PAN, RIGHT: MOUSE.ROTATE }} />
    </>
  );
});
