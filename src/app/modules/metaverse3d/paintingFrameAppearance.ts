import type {
  ExhibitItem,
  PaintingFrameAppearance,
  PaintingFrameStyle,
} from "./types";

export interface PaintingFramePreset {
  id: PaintingFrameStyle;
  label: string;
  description: string;
  appearance: PaintingFrameAppearance;
}

export const PAINTING_FRAME_PRESETS: readonly PaintingFramePreset[] = [
  {
    id: "modern",
    label: "現代黑框",
    description: "俐落霧黑，適合攝影與數位藝術",
    appearance: {
      frameStyle: "modern",
      frameColor: "#17191d",
      frameInnerColor: "#6b7280",
      frameThickness: 0.09,
      frameDepth: 0.08,
      frameMatEnabled: false,
      frameMatColor: "#f5f2ea",
      frameMatWidth: 0.12,
      frameGlassEnabled: false,
    },
  },
  {
    id: "classic",
    label: "經典金框",
    description: "暖金雙層線條，適合繪畫與典藏品",
    appearance: {
      frameStyle: "classic",
      frameColor: "#9a6b2f",
      frameInnerColor: "#e4c579",
      frameThickness: 0.14,
      frameDepth: 0.1,
      frameMatEnabled: false,
      frameMatColor: "#f8f3e7",
      frameMatWidth: 0.12,
      frameGlassEnabled: false,
    },
  },
  {
    id: "natural",
    label: "自然木框",
    description: "溫潤木色，適合插畫與生活攝影",
    appearance: {
      frameStyle: "natural",
      frameColor: "#8b5e3c",
      frameInnerColor: "#d6aa72",
      frameThickness: 0.11,
      frameDepth: 0.09,
      frameMatEnabled: true,
      frameMatColor: "#f5f0e5",
      frameMatWidth: 0.12,
      frameGlassEnabled: false,
    },
  },
  {
    id: "metal",
    label: "細銀框",
    description: "輕薄金屬質感，適合極簡展場",
    appearance: {
      frameStyle: "metal",
      frameColor: "#b9c0c8",
      frameInnerColor: "#f2f4f7",
      frameThickness: 0.045,
      frameDepth: 0.055,
      frameMatEnabled: true,
      frameMatColor: "#f7f7f4",
      frameMatWidth: 0.08,
      frameGlassEnabled: true,
    },
  },
  {
    id: "floating",
    label: "懸浮框",
    description: "作品與外框留有陰影縫隙，立體感較強",
    appearance: {
      frameStyle: "floating",
      frameColor: "#2a211c",
      frameInnerColor: "#08090a",
      frameThickness: 0.075,
      frameDepth: 0.13,
      frameMatEnabled: false,
      frameMatColor: "#111827",
      frameMatWidth: 0.065,
      frameGlassEnabled: false,
    },
  },
  {
    id: "borderless",
    label: "無框展示",
    description: "只保留作品與薄背板，適合沉浸式影像",
    appearance: {
      frameStyle: "borderless",
      frameColor: "#111827",
      frameInnerColor: "#111827",
      frameThickness: 0.02,
      frameDepth: 0.025,
      frameMatEnabled: false,
      frameMatColor: "#ffffff",
      frameMatWidth: 0,
      frameGlassEnabled: false,
    },
  },
] as const;

const DEFAULT_APPEARANCE = PAINTING_FRAME_PRESETS[0].appearance;

export function getPaintingFrameAppearance(
  item: Pick<
    ExhibitItem,
    | "frameStyle"
    | "frameColor"
    | "frameInnerColor"
    | "frameThickness"
    | "frameDepth"
    | "frameMatEnabled"
    | "frameMatColor"
    | "frameMatWidth"
    | "frameGlassEnabled"
  >,
): PaintingFrameAppearance {
  return {
    frameStyle: item.frameStyle ?? DEFAULT_APPEARANCE.frameStyle,
    frameColor: item.frameColor ?? DEFAULT_APPEARANCE.frameColor,
    frameInnerColor: item.frameInnerColor ?? DEFAULT_APPEARANCE.frameInnerColor,
    frameThickness: Math.max(
      0.02,
      Math.min(0.3, item.frameThickness ?? DEFAULT_APPEARANCE.frameThickness),
    ),
    frameDepth: Math.max(
      0.02,
      Math.min(0.2, item.frameDepth ?? DEFAULT_APPEARANCE.frameDepth),
    ),
    frameMatEnabled: item.frameMatEnabled ?? DEFAULT_APPEARANCE.frameMatEnabled,
    frameMatColor: item.frameMatColor ?? DEFAULT_APPEARANCE.frameMatColor,
    frameMatWidth: Math.max(
      0,
      Math.min(0.35, item.frameMatWidth ?? DEFAULT_APPEARANCE.frameMatWidth),
    ),
    frameGlassEnabled:
      item.frameGlassEnabled ?? DEFAULT_APPEARANCE.frameGlassEnabled,
  };
}

export function getPaintingFrameMaterial(style: PaintingFrameStyle) {
  if (style === "metal") {
    return { roughness: 0.32, metalness: 0.95, clearcoat: 0.08 };
  }
  if (style === "classic") {
    return { roughness: 0.36, metalness: 0.9, clearcoat: 0.12 };
  }
  if (style === "natural") {
    return { roughness: 0.68, metalness: 0, clearcoat: 0.18 };
  }
  if (style === "floating") {
    return { roughness: 0.6, metalness: 0, clearcoat: 0.12 };
  }
  return { roughness: 0.58, metalness: 0, clearcoat: 0.08 };
}
