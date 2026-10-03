import type { FloorPlanElement } from "../../src/app/modules/metaverse3d/types";

export const DEFAULT_DOOR_WIDTH = 1.8;
export const DEFAULT_DOOR_HEIGHT = 2.6;

export type RoomBounds = {
  id: string;
  isLocked: boolean;
  doorOffset: number;
  doorWidth: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export type Side = "north" | "south" | "east" | "west";

export type WallSegment = {
  id: string;
  face: Side;
  position: [number, number, number];
  rotation: [number, number, number];
  rotationY: number;
  size: [number, number, number];
};

export type WallTopology = {
  segments: WallSegment[];
  doorOpenings: Array<{ id: string; position: [number, number, number]; rotationY: number; width: number; height?: number; depth?: number }>;
};


export function getFloorPlanRoomBounds(elements: FloorPlanElement[], width: number, length: number): RoomBounds[];
export function getFloorPlanCenter(bounds: RoomBounds[]): { x: number; z: number };
export function createSegments(start: number, end: number, cuts: Array<[number, number]>): Array<[number, number]>;
export function buildWallTopology(bounds: RoomBounds[], height: number, thickness: number, center: { x: number; z: number }): WallTopology;
