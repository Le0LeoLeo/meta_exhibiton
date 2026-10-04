import { useEffect, useMemo } from "react";
import { MeshStandardMaterial, type ColorRepresentation } from "three";
import type {
  WallSegment,
  WallTopology,
} from "../store/floorPlanGeometry";
import { BeveledBox } from "./geometry/BeveledBox";
import { DEFAULT_DOOR_HEIGHT } from "../store/floorPlanGeometry";

type DoorOpening = WallTopology["doorOpenings"][number];

export interface ArchitecturalTrimProps {
  wallSegments: readonly WallSegment[];
  doorOpenings?: readonly DoorOpening[];
  baseboardColor?: ColorRepresentation;
  showCeilingShadowGap?: boolean;
  showJunctionDetails?: boolean;
  doorHeight?: number;
}

const BASEBOARD_HEIGHT = 0.08;
const BASEBOARD_DEPTH = 0.012;
const CEILING_GAP_HEIGHT = 0.03;
const DOOR_TRIM_WIDTH = 0.08;
// Wrap the exposed wall ends instead of leaving coplanar jamb/soffit faces.
const DOOR_REVEAL_OVERLAP = 0.008;
const VERTICAL_SEAM_WIDTH = 0.012;
const VERTICAL_SEAM_DEPTH = 0.008;
const THRESHOLD_HEIGHT = 0.012;
const THRESHOLD_DEPTH = 0.14;

export interface VerticalSeamLayout {
  id: string;
  position: [number, number, number];
  rotation: WallSegment["rotation"];
  height: number;
}

export interface FloorThresholdLayout {
  id: string;
  position: [number, number, number];
  rotationY: number;
  dimensions: [number, number, number];
}

function getInwardOffset(face: WallSegment["face"], distance: number) {
  if (face === "north") return [0, distance] as const;
  if (face === "south") return [0, -distance] as const;
  if (face === "east") return [-distance, 0] as const;
  return [distance, 0] as const;
}

function getWallEndpoints(wall: WallSegment) {
  const halfLength = wall.size[0] / 2;
  const rotationY = wall.rotation[1];
  const axisX = Math.cos(rotationY);
  const axisZ = -Math.sin(rotationY);

  return [-1, 1].map((direction) => ({
    wall,
    x: wall.position[0] + direction * halfLength * axisX,
    z: wall.position[2] + direction * halfLength * axisZ,
    axisX,
    axisZ,
  }));
}

/** Returns a deliberately sparse set of visual seams at perpendicular wall ends. */
export function getVerticalSeamLayout(
  wallSegments: readonly WallSegment[],
): VerticalSeamLayout[] {
  const endpointGroups = new Map<
    string,
    ReturnType<typeof getWallEndpoints>
  >();

  for (const endpoint of wallSegments.filter((wall) => wall.position[1] - wall.size[1] / 2 < 0.05).flatMap(getWallEndpoints)) {
    const key = `${endpoint.x.toFixed(2)}:${endpoint.z.toFixed(2)}`;
    const group = endpointGroups.get(key) ?? [];
    group.push(endpoint);
    endpointGroups.set(key, group);
  }

  const junctions = [...endpointGroups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([key, endpoints]) => {
      const sorted = [...endpoints].sort((a, b) =>
        a.wall.id.localeCompare(b.wall.id),
      );
      const anchor = sorted.find((candidate, index) =>
        sorted.some(
          (other, otherIndex) =>
            otherIndex !== index &&
            Math.abs(
              candidate.axisX * other.axisX + candidate.axisZ * other.axisZ,
            ) < 0.1,
        ),
      );
      if (!anchor) return [];

      const wall = anchor.wall;
      const height = Math.max(0.1, wall.size[1] - 0.16);
      const floorY = wall.position[1] - wall.size[1] / 2;
      const distance = wall.size[2] / 2 + VERTICAL_SEAM_DEPTH / 2;
      const [offsetX, offsetZ] = getInwardOffset(wall.face, distance);

      return [
        {
          id: `vertical-seam:${key}`,
          position: [
            anchor.x + offsetX,
            floorY + 0.08 + height / 2,
            anchor.z + offsetZ,
          ] as [number, number, number],
          rotation: wall.rotation,
          height,
        },
      ];
    });

  return junctions.filter((_, index) => index % 2 === 0);
}

/** Creates thin non-colliding metal transitions for traversable openings. */
export function getFloorThresholdLayout(
  doorOpenings: readonly DoorOpening[],
): FloorThresholdLayout[] {
  return doorOpenings
    .filter((opening) => opening.width >= 0.6)
    .map((opening) => ({
      id: `threshold:${opening.id}`,
      position: [
        opening.position[0],
        opening.position[1] + THRESHOLD_HEIGHT / 2,
        opening.position[2],
      ],
      rotationY: opening.rotationY,
      dimensions: [opening.width, THRESHOLD_HEIGHT, THRESHOLD_DEPTH],
    }));
}

export function ArchitecturalTrim({
  wallSegments,
  doorOpenings = [],
  baseboardColor = "#e7e5e4",
  showCeilingShadowGap = false,
  showJunctionDetails = showCeilingShadowGap,
  doorHeight = DEFAULT_DOOR_HEIGHT,
}: ArchitecturalTrimProps) {
  const verticalSeams = useMemo(
    () =>
      showJunctionDetails ? getVerticalSeamLayout(wallSegments) : [],
    [showJunctionDetails, wallSegments],
  );
  const floorThresholds = useMemo(
    () =>
      showJunctionDetails ? getFloorThresholdLayout(doorOpenings) : [],
    [doorOpenings, showJunctionDetails],
  );
  const baseboardMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: baseboardColor,
        roughness: 0.72,
        metalness: 0,
      }),
    [baseboardColor],
  );
  const shadowGapMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: "#292524",
        roughness: 0.9,
        metalness: 0,
      }),
    [],
  );
  const thresholdMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: "#8a8d8f",
        roughness: 0.38,
        metalness: 0.82,
      }),
    [],
  );
  const doorFrameMaterial = useMemo(
    () => new MeshStandardMaterial({ color: "#756b5e", roughness: 0.48, metalness: 0.35 }),
    [],
  );

  useEffect(() => () => baseboardMaterial.dispose(), [baseboardMaterial]);
  useEffect(() => () => shadowGapMaterial.dispose(), [shadowGapMaterial]);
  useEffect(() => () => thresholdMaterial.dispose(), [thresholdMaterial]);
  useEffect(() => () => doorFrameMaterial.dispose(), [doorFrameMaterial]);

  return (
    <group>
      {wallSegments.map((wall) => {
        const distance = wall.size[2] / 2 + BASEBOARD_DEPTH / 2;
        const [offsetX, offsetZ] = getInwardOffset(wall.face, distance);
        const floorY = wall.position[1] - wall.size[1] / 2;

        return (
          <group key={wall.id}>
            {floorY < 0.05 && <BeveledBox
              dimensions={[wall.size[0], BASEBOARD_HEIGHT, BASEBOARD_DEPTH]}
              bevelRadius={0.004}
              position={[
                wall.position[0] + offsetX,
                floorY + BASEBOARD_HEIGHT / 2,
                wall.position[2] + offsetZ,
              ]}
              rotation={wall.rotation}
              material={baseboardMaterial}
              receiveShadow
            />}
            {showCeilingShadowGap && (
              <BeveledBox
                dimensions={[wall.size[0], CEILING_GAP_HEIGHT, BASEBOARD_DEPTH]}
                bevelRadius={0.003}
                position={[
                  wall.position[0] + offsetX,
                  wall.position[1] + wall.size[1] / 2 - CEILING_GAP_HEIGHT / 2,
                  wall.position[2] + offsetZ,
                ]}
                rotation={wall.rotation}
                material={shadowGapMaterial}
              />
            )}
          </group>
        );
      })}

      {doorOpenings.map((opening) => {
        const height = opening.height ?? doorHeight;
        // Span the wall thickness so the frame is visible from both rooms.
        // An 8mm return covers the wall end faces, avoiding depth fighting
        // at both jambs and the lintel when viewed from inside the doorway.
        const depth = (opening.depth ?? 0.12) + 0.04;
        return (
        <group
          key={opening.id}
          position={opening.position}
          rotation={[0, opening.rotationY, 0]}
        >
          {[-1, 1].map((side) => (
            <BeveledBox
              key={side}
              dimensions={[DOOR_TRIM_WIDTH + DOOR_REVEAL_OVERLAP, height - DOOR_REVEAL_OVERLAP, depth]}
              bevelRadius={0.004}
              position={[
                side * (opening.width / 2 + (DOOR_TRIM_WIDTH - DOOR_REVEAL_OVERLAP) / 2),
                (height - DOOR_REVEAL_OVERLAP) / 2,
                0,
              ]}
              material={doorFrameMaterial}
              receiveShadow
            />
          ))}
          <BeveledBox
            dimensions={[
              opening.width + DOOR_TRIM_WIDTH * 2,
              DOOR_TRIM_WIDTH + DOOR_REVEAL_OVERLAP,
              depth,
            ]}
            bevelRadius={0.004}
            position={[0, height + (DOOR_TRIM_WIDTH - DOOR_REVEAL_OVERLAP) / 2, 0]}
            material={doorFrameMaterial}
            receiveShadow
          />
        </group>
      );})}

      {verticalSeams.map((seam) => (
        <BeveledBox
          key={seam.id}
          dimensions={[VERTICAL_SEAM_WIDTH, seam.height, VERTICAL_SEAM_DEPTH]}
          bevelRadius={0.002}
          position={seam.position}
          rotation={seam.rotation}
          material={shadowGapMaterial}
        />
      ))}

      {floorThresholds.map((threshold) => (
        <BeveledBox
          key={threshold.id}
          dimensions={threshold.dimensions}
          bevelRadius={0.002}
          position={threshold.position}
          rotation={[0, threshold.rotationY, 0]}
          material={thresholdMaterial}
          receiveShadow
        />
      ))}
    </group>
  );
}
