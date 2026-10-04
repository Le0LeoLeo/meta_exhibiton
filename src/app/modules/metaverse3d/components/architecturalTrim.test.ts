import { describe, expect, it } from "vitest";
import type { WallSegment, WallTopology } from "../store/floorPlanGeometry";
import {
  getFloorThresholdLayout,
  getVerticalSeamLayout,
} from "./ArchitecturalTrim";

const walls: WallSegment[] = [
  {
    id: "north",
    face: "north",
    position: [0, 1.5, -5],
    rotation: [0, 0, 0],
    rotationY: 0,
    size: [10, 3, 0.2],
  },
  {
    id: "south",
    face: "south",
    position: [0, 1.5, 5],
    rotation: [0, Math.PI, 0],
    rotationY: Math.PI,
    size: [10, 3, 0.2],
  },
  {
    id: "east",
    face: "east",
    position: [5, 1.5, 0],
    rotation: [0, Math.PI / 2, 0],
    rotationY: -Math.PI / 2,
    size: [10, 3, 0.2],
  },
  {
    id: "west",
    face: "west",
    position: [-5, 1.5, 0],
    rotation: [0, Math.PI / 2, 0],
    rotationY: Math.PI / 2,
    size: [10, 3, 0.2],
  },
];

describe("getVerticalSeamLayout", () => {
  it("returns a deterministic, sparse selection of shared wall junctions", () => {
    const first = getVerticalSeamLayout(walls);
    const second = getVerticalSeamLayout(walls);

    expect(second).toEqual(first);
    expect(first).toHaveLength(2);
    expect(new Set(first.map((seam) => seam.id)).size).toBe(first.length);
    expect(first.every((seam) => seam.height < 3 && seam.height > 2.5)).toBe(
      true,
    );
  });

  it("does not add a decorative seam to an isolated wall end", () => {
    expect(getVerticalSeamLayout(walls.slice(0, 1))).toEqual([]);
  });
});

describe("getFloorThresholdLayout", () => {
  it("creates one thin, floor-level metal strip per door opening", () => {
    const openings: WallTopology["doorOpenings"] = [
      {
        id: "door-a",
        position: [1, 0, -2],
        rotationY: Math.PI / 2,
        width: 1.4,
      },
      {
        id: "door-b",
        position: [-2, 0, 3],
        rotationY: 0,
        width: 1,
      },
    ];

    const layout = getFloorThresholdLayout(openings);

    expect(layout).toHaveLength(2);
    expect(layout[0]).toMatchObject({
      id: "threshold:door-a",
      dimensions: [1.4, 0.012, 0.14],
      position: [1, 0.006, -2],
      rotationY: Math.PI / 2,
    });
    expect(layout[1].dimensions[0]).toBe(1);
  });

  it("is stable and ignores openings too narrow to be traversable", () => {
    const openings: WallTopology["doorOpenings"] = [
      { id: "invalid", position: [0, 0, 0], rotationY: 0, width: 0.3 },
    ];

    expect(getFloorThresholdLayout(openings)).toEqual([]);
  });
});
