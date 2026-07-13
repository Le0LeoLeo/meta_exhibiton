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
  { label: "乳膠漆細紋", value: "/textures/wall-paint.svg" },
  { label: "清水混凝土", value: "/textures/wall-concrete.svg" },
  { label: "木紋", value: "/textures/wall-wood.svg" },
  { label: "金屬髮絲紋", value: "/textures/wall-metal.svg" },
] as const;

export const floorTexturePresets = [
  { label: "霧面石材", value: "/textures/wall-concrete.svg" },
  { label: "木地板", value: "/textures/wall-wood.svg" },
  { label: "細紋塗層", value: "/textures/wall-paint.svg" },
  { label: "金屬地坪", value: "/textures/wall-metal.svg" },
] as const;

export const decorThemePresets: Array<{ name: string; settings: Partial<RoomSize> }> = [
  {
    name: "北歐畫廊",
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

export const selectedItemTypeLabelMap: Partial<Record<ExhibitItem["type"], string>> = {
  painting: "畫作",
  pedestal: "展台",
  text: "文字",
  partition: "隔間牆",
  lightstrip: "燈條",
  flower: "花藝",
  chandelier: "吊燈",
  bench: "長椅",
  rug: "地毯",
  vase: "花瓶",
  sculpture: "雕塑",
  spotlight: "投射燈",
  plant: "盆栽",
  column: "立柱",
  neon: "霓虹牌",
};

export const itemToolButtons: Array<{
  type: ExhibitItem["type"];
  label: string;
  icon: typeof Square;
  className: string;
}> = [
  { type: "painting", label: "畫作", icon: ImageIcon, className: "text-white/90 hover:bg-white/10" },
  { type: "pedestal", label: "展台", icon: Square, className: "text-white/90 hover:bg-white/10" },
  { type: "text", label: "文字", icon: Type, className: "text-white/90 hover:bg-white/10" },
  { type: "partition", label: "隔間牆", icon: Columns, className: "text-white/90 hover:bg-white/10" }
];

export const modelLibraryButtons: Array<{
  type: ExhibitItem["type"];
  label: string;
  icon: typeof Square;
  className: string;
}> = [
  { type: "lightstrip", label: "燈條", icon: Lamp, className: "text-white/85 hover:bg-white/10" },
  { type: "flower", label: "花藝", icon: Flower2, className: "text-white/85 hover:bg-white/10" },
  { type: "chandelier", label: "吊燈", icon: Lightbulb, className: "text-white/85 hover:bg-white/10" },
  { type: "bench", label: "長椅", icon: Armchair, className: "text-white/85 hover:bg-white/10" },
  { type: "rug", label: "地毯", icon: RectangleHorizontal, className: "text-white/85 hover:bg-white/10" },
  { type: "vase", label: "花瓶", icon: Package, className: "text-white/85 hover:bg-white/10" },
  { type: "sculpture", label: "雕塑", icon: Shapes, className: "text-white/85 hover:bg-white/10" },
  { type: "spotlight", label: "投射燈", icon: ScanSearch, className: "text-white/85 hover:bg-white/10" },
  { type: "plant", label: "盆栽", icon: Leaf, className: "text-white/85 hover:bg-white/10" },
  { type: "column", label: "立柱", icon: Pill, className: "text-white/85 hover:bg-white/10" },
  { type: "neon", label: "霓虹牌", icon: Zap, className: "text-white/85 hover:bg-white/10" }
];
