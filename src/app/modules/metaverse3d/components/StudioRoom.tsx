import { useMemo } from "react";
import { useMetaverseStudioStore } from "../store/useMetaverseStudioStore";

export function StudioRoom() {
  const roomSize = useMetaverseStudioStore((s) => s.roomSize);
  const mode = useMetaverseStudioStore((s) => s.mode);
  const selectedWallFace = useMetaverseStudioStore((s) => s.selectedWallFace);
  const setSelectedWallFace = useMetaverseStudioStore((s) => s.setSelectedWallFace);

  const hw = roomSize.width / 2;
  const hl = roomSize.length / 2;

  const wallColor = useMemo(() => roomSize.wallColor, [roomSize.wallColor]);
  const floorColor = useMemo(() => roomSize.floorColor, [roomSize.floorColor]);

  const handleWallClick = (face: "north" | "south" | "east" | "west", e: any) => {
    if (mode !== "edit") return;
    e.stopPropagation();
    setSelectedWallFace(face);
  };

  return (
    <group>
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[roomSize.width, 0.1, roomSize.length]} />
        <meshStandardMaterial color={floorColor} roughness={0.85} metalness={0.08} />
      </mesh>

      <mesh position={[0, roomSize.height + 0.05, 0]} receiveShadow>
        <boxGeometry args={[roomSize.width, 0.1, roomSize.length]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.9} metalness={0.02} />
      </mesh>

      <mesh
        position={[0, roomSize.height / 2, -hl]}
        onPointerDown={(e) => handleWallClick("north", e)}
      >
        <boxGeometry args={[roomSize.width, roomSize.height, roomSize.wallThickness]} />
        <meshStandardMaterial color={selectedWallFace === "north" ? "#dbeafe" : wallColor} />
      </mesh>

      <mesh
        position={[0, roomSize.height / 2, hl]}
        onPointerDown={(e) => handleWallClick("south", e)}
      >
        <boxGeometry args={[roomSize.width, roomSize.height, roomSize.wallThickness]} />
        <meshStandardMaterial color={selectedWallFace === "south" ? "#dbeafe" : wallColor} />
      </mesh>

      <mesh
        position={[hw, roomSize.height / 2, 0]}
        onPointerDown={(e) => handleWallClick("east", e)}
      >
        <boxGeometry args={[roomSize.wallThickness, roomSize.height, roomSize.length]} />
        <meshStandardMaterial color={selectedWallFace === "east" ? "#dbeafe" : wallColor} />
      </mesh>

      <mesh
        position={[-hw, roomSize.height / 2, 0]}
        onPointerDown={(e) => handleWallClick("west", e)}
      >
        <boxGeometry args={[roomSize.wallThickness, roomSize.height, roomSize.length]} />
        <meshStandardMaterial color={selectedWallFace === "west" ? "#dbeafe" : wallColor} />
      </mesh>
    </group>
  );
}
