export type ItemType =
  | "painting"
  | "pedestal"
  | "text"
  | "partition"
  | "lightstrip"
  | "flower"
  | "chandelier"
  | "bench"
  | "rug"
  | "vase"
  | "sculpture"
  | "spotlight"
  | "plant"
  | "column"
  | "neon";

export interface ExhibitItem {
  id: string;
  type: ItemType;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  content: string;
  fileName?: string;
  fileMimeType?: string;
  videoThumbnailUrl?: string;
  videoAutoplay?: boolean;
  videoLoop?: boolean;
  videoMuted?: boolean;
  frameWidth?: number;
  frameHeight?: number;
  modelOffset?: [number, number, number];
  title?: string;
  artist?: string;
  description?: string;
  externalUrl?: string;
  textFontFamily?: "sans" | "serif" | "mono";
  textColor?: string;
  textFontSize?: number;
  textIsBold?: boolean;
  textBackboardEnabled?: boolean;
  textBackboardColor?: string;
  lightIntensity?: number;
  isLocked?: boolean;
}

export type WallFace = "north" | "south" | "east" | "west";

export interface WallAnchor {
  face: WallFace;
  position: [number, number, number];
  rotationY: number;
}

export type WallMaterialPreset = "paint" | "concrete" | "metal" | "wood" | "glass";

export interface RoomSize {
  width: number;
  length: number;
  height: number;
  wallThickness: number;
  wallColor: string;
  wallMaterialPreset: WallMaterialPreset;
  wallTextureUrl: string;
  wallTextureTiling: number;
  wallRoughness: number;
  wallMetalness: number;
  wallBumpScale: number;
  wallEnvIntensity: number;
  wallOpacity: number;
  wallTransmission: number;
  wallIor: number;
  floorColor: string;
  floorTextureUrl: string;
  floorTextureTiling: number;
  floorRoughness: number;
  floorMetalness: number;
  environmentBrightness: number;
}

export type WallMaterialSettings = Pick<
  RoomSize,
  | "wallColor"
  | "wallMaterialPreset"
  | "wallTextureUrl"
  | "wallTextureTiling"
  | "wallRoughness"
  | "wallMetalness"
  | "wallBumpScale"
  | "wallEnvIntensity"
  | "wallOpacity"
  | "wallTransmission"
  | "wallIor"
>;

export type AppMode = "edit" | "view" | "floor-plan";

export type FloorPlanElementType = "room" | "wall";

export interface FloorPlanElement {
  id: string;
  type: FloorPlanElementType;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color?: string;
  isLocked?: boolean;
}
