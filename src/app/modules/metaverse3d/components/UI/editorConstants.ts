import {
  Armchair,
  Columns,
  Flower2,
  Image as ImageIcon,
  Lamp,
  Leaf,
  Lightbulb,
  Package,
  Pill,
  RectangleHorizontal,
  ScanSearch,
  Shapes,
  Square,
  Type,
  Zap,
} from "lucide-react";
import { ExhibitItem, RoomSize } from "../../types";

export const wallTexturePresets = [
  { labelKey: "editorWallTexturePaint", value: "/textures/wall-paint.svg" },
  { labelKey: "editorWallTextureConcrete", value: "/textures/wall-concrete.svg" },
  { labelKey: "editorWallTextureWood", value: "/textures/wall-wood.svg" },
  { labelKey: "editorWallTextureMetal", value: "/textures/wall-metal.svg" },
] as const;

export const floorTexturePresets = [
  { labelKey: "editorFloorTextureStone", value: "/textures/wall-concrete.svg" },
  { labelKey: "editorFloorTextureWood", value: "/textures/wall-wood.svg" },
  { labelKey: "editorFloorTextureCoating", value: "/textures/wall-paint.svg" },
  { labelKey: "editorFloorTextureMetal", value: "/textures/wall-metal.svg" },
] as const;

export const decorThemePresets: Array<{ name: string; labelKey: string; settings: Partial<RoomSize> }> = [
  {
    name: "北歐畫廊",
    labelKey: "editorPresetNordicGallery",
    settings: {
      wallMaterialPreset: "paint",
      wallColor: "#f4f1ea",
      wallTextureUrl: "/textures/wall-paint.svg",
      wallTextureTiling: 2,
      wallRoughness: 0.58,
      wallMetalness: 0.03,
      wallBumpScale: 0.04,
      wallEnvIntensity: 0.45,
    },
  },
  {
    name: "工業風",
    labelKey: "editorPresetIndustrial",
    settings: {
      wallMaterialPreset: "concrete",
      wallColor: "#9ca3af",
      wallTextureUrl: "/textures/wall-concrete.svg",
      wallTextureTiling: 3.5,
      wallRoughness: 0.88,
      wallMetalness: 0.08,
      wallBumpScale: 0.14,
      wallEnvIntensity: 0.22,
    },
  },
  {
    name: "木質藝廊",
    labelKey: "editorPresetWarmWood",
    settings: {
      wallMaterialPreset: "wood",
      wallColor: "#b08968",
      wallTextureUrl: "/textures/wall-wood.svg",
      wallTextureTiling: 2.5,
      wallRoughness: 0.72,
      wallMetalness: 0.06,
      wallBumpScale: 0.1,
      wallEnvIntensity: 0.32,
    },
  },
  {
    name: "未來金屬",
    labelKey: "editorPresetFutureMetal",
    settings: {
      wallMaterialPreset: "metal",
      wallColor: "#cbd5e1",
      wallTextureUrl: "/textures/wall-metal.svg",
      wallTextureTiling: 4,
      wallRoughness: 0.2,
      wallMetalness: 0.9,
      wallBumpScale: 0.03,
      wallEnvIntensity: 0.95,
      wallOpacity: 1,
      wallTransmission: 0,
      wallIor: 1.45,
    },
  },
  {
    name: "玻璃空間",
    labelKey: "editorPresetGlassSpace",
    settings: {
      wallMaterialPreset: "glass",
      wallColor: "#e0f2fe",
      wallTextureUrl: "/textures/wall-paint.svg",
      wallTextureTiling: 2,
      wallRoughness: 0.08,
      wallMetalness: 0,
      wallBumpScale: 0,
      wallEnvIntensity: 1.1,
      wallOpacity: 0.45,
      wallTransmission: 0.92,
      wallIor: 1.5,
    },
  },
];

export const selectedItemTypeLabelMap: Record<ExhibitItem["type"], string> = {
  painting: "editorAddPainting",
  pedestal: "editorAddPedestal",
  text: "editorAddText",
  partition: "editorAddPartition",
  lightstrip: "editorItemLightstrip",
  flower: "editorItemFlower",
  chandelier: "editorItemChandelier",
  bench: "editorItemBench",
  rug: "editorItemRug",
  vase: "editorItemVase",
  sculpture: "editorItemSculpture",
  spotlight: "editorItemSpotlight",
  plant: "editorItemPlant",
  column: "editorItemColumn",
  neon: "editorItemNeon",
  chair: "editorItemChair",
  sofa: "editorItemSofa",
  floorlamp: "editorItemFloorLamp",
  cabinet: "editorItemCabinet",
  turntable: "editorItemTurntable",
  fountain: "editorItemFountain",
};

export const editorThemePresetLabelKeys: Record<string, string> = {
  "nordic-gallery": "editorPresetNordicGallery",
  industrial: "editorPresetIndustrial",
  "warm-wood": "editorPresetWarmWood",
  "future-metal": "editorPresetFutureMetal",
  "glass-space": "editorPresetGlassSpace",
};

export const itemToolButtons: Array<{
  type: ExhibitItem["type"];
  preset?: 'vehicle-platform';
  labelKey: string;
  icon: typeof Square;
  className: string;
}> = [
  { type: "painting", labelKey: "editorAddPainting", icon: ImageIcon, className: "text-white/90 hover:bg-white/10" },
  { type: "pedestal", labelKey: "editorAddPedestal", icon: Square, className: "text-white/90 hover:bg-white/10" },
  { type: "pedestal", preset: 'vehicle-platform', labelKey: 'editorRectangularPlatform', icon: RectangleHorizontal, className: "text-white/90 hover:bg-white/10" },
  { type: "text", labelKey: "editorAddText", icon: Type, className: "text-white/90 hover:bg-white/10" },
  { type: "partition", labelKey: "editorAddPartition", icon: Columns, className: "text-white/90 hover:bg-white/10" }
];

export const modelLibraryButtons: Array<{
  type: ExhibitItem["type"];
  labelKey: string;
  icon: typeof Square;
  className: string;
}> = [
  { type: "lightstrip", labelKey: "editorItemLightstrip", icon: Lamp, className: "text-white/85 hover:bg-white/10" },
  { type: "flower", labelKey: "editorItemFlower", icon: Flower2, className: "text-white/85 hover:bg-white/10" },
  { type: "chandelier", labelKey: "editorItemChandelier", icon: Lightbulb, className: "text-white/85 hover:bg-white/10" },
  { type: "bench", labelKey: "editorItemBench", icon: Armchair, className: "text-white/85 hover:bg-white/10" },
  { type: "rug", labelKey: "editorItemRug", icon: RectangleHorizontal, className: "text-white/85 hover:bg-white/10" },
  { type: "vase", labelKey: "editorItemVase", icon: Package, className: "text-white/85 hover:bg-white/10" },
  { type: "sculpture", labelKey: "editorItemSculpture", icon: Shapes, className: "text-white/85 hover:bg-white/10" },
  { type: "spotlight", labelKey: "editorItemSpotlight", icon: ScanSearch, className: "text-white/85 hover:bg-white/10" },
  { type: "plant", labelKey: "editorItemPlant", icon: Leaf, className: "text-white/85 hover:bg-white/10" },
  { type: "column", labelKey: "editorItemColumn", icon: Pill, className: "text-white/85 hover:bg-white/10" },
  { type: "neon", labelKey: "editorItemNeon", icon: Zap, className: "text-white/85 hover:bg-white/10" },
  { type: "chair", labelKey: "editorItemChair", icon: Armchair, className: "text-white/85 hover:bg-white/10" },
  { type: "sofa", labelKey: "editorItemSofa", icon: Armchair, className: "text-white/85 hover:bg-white/10" },
  { type: "floorlamp", labelKey: "editorItemFloorLamp", icon: Lamp, className: "text-white/85 hover:bg-white/10" },
  { type: "cabinet", labelKey: "editorItemCabinet", icon: Package, className: "text-white/85 hover:bg-white/10" },
  { type: "turntable", labelKey: "editorItemTurntable", icon: ScanSearch, className: "text-white/85 hover:bg-white/10" },
  { type: "fountain", labelKey: "editorItemFountain", icon: Shapes, className: "text-white/85 hover:bg-white/10" }
];
