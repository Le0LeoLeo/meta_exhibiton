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
  | "neon"
  | "chair"
  | "sofa"
  | "floorlamp"
  | "cabinet"
  | "turntable"
  | "fountain";

export interface PendingPlacement {
  type: ItemType;
  position: [number, number, number];
  rotation: [number, number, number];
  wallSide: "front" | "back";
  surfaceKind?: "room-wall" | "partition";
  surfaceId?: string | null;
  batchPositions?: Array<[number, number, number]>;
  batchRotation?: [number, number, number];
  autoTopLightstrip?: boolean;
  itemDefaults?: Partial<ExhibitItem>;
}

export type PaintingFrameStyle =
  | "modern"
  | "classic"
  | "natural"
  | "metal"
  | "floating"
  | "borderless";

export interface PaintingFrameAppearance {
  frameStyle: PaintingFrameStyle;
  frameColor: string;
  frameInnerColor: string;
  frameThickness: number;
  frameDepth: number;
  frameMatEnabled: boolean;
  frameMatColor: string;
  frameMatWidth: number;
  frameGlassEnabled: boolean;
}

/** Public creator-supplied context. Source URLs are metadata and are never fetched by the guide. */
export interface ExhibitWorkContext {
  contribution?: string;
  process?: string;
  outcome?: string;
  reflection?: string;
  sources?: Array<{
    label: string;
    url?: string;
    excerpt?: string;
  }>;
}

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
  /** Original image width / height; absent in legacy scenes that fill the canvas. */
  imageAspectRatio?: number;
  frameStyle?: PaintingFrameStyle;
  frameColor?: string;
  frameInnerColor?: string;
  frameThickness?: number;
  frameDepth?: number;
  frameMatEnabled?: boolean;
  frameMatColor?: string;
  frameMatWidth?: number;
  frameGlassEnabled?: boolean;
  modelOffset?: [number, number, number];
  title?: string;
  artist?: string;
  description?: string;
  workContext?: ExhibitWorkContext;
  externalUrl?: string;
  textFontFamily?: "sans" | "serif" | "mono";
  textColor?: string;
  textFontSize?: number;
  textIsBold?: boolean;
  textBackboardEnabled?: boolean;
  textBackboardColor?: string;
  lightIntensity?: number;
  isLocked?: boolean;
  uploadStatus?: "pending" | "uploading" | "done" | "error";
  uploadProgress?: number;
  assetId?: string;
  boxContentId?: string;
  assetUrl?: string;
  thumbnailUrl?: string;
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
  wallTextureCustomPresets?: Array<{ label: string; value: string }>;
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

export type PerformanceMode = "auto" | "quality" | "balanced" | "performance";
export type LegacyPerformanceMode = PerformanceMode | "low";

export type FloorPlanElementType = "room" | "wall";

export interface FloorPlanElement {
  id: string;
  type: FloorPlanElementType;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color?: string;
  isLocked?: boolean;
  doorOffset?: number;
  doorWidth?: number;
}
