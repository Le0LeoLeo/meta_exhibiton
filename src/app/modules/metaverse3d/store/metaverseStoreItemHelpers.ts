import { v4 as uuidv4 } from "uuid";
import type { ExhibitItem, RoomSize } from "../types";

function getDefaultItemScale(type: ExhibitItem["type"], roomSize: RoomSize): [number, number, number] {
  if (type === "partition") return [5, roomSize.height, 0.2];
  if (type === "lightstrip") return [2, 0.12, 0.12];
  if (type === "flower") return [0.8, 0.8, 0.8];
  if (type === "chandelier") return [0.9, 0.9, 0.9];
  if (type === "bench") return [2.4, 1.1, 1];
  if (type === "rug") return [2.4, 1, 1.6];
  if (type === "vase") return [0.9, 1.1, 0.9];
  if (type === "sculpture") return [1.3, 1.8, 1.3];
  if (type === "spotlight") return [0.9, 1.2, 0.9];
  if (type === "plant") return [1.1, 1.4, 1.1];
  if (type === "column") return [1, 3, 1];
  if (type === "neon") return [1.8, 0.8, 0.22];
  return [1, 1, 1];
}

function getDefaultItemContent(type: ExhibitItem["type"]): string {
  if (type === "painting") return "https://images.unsplash.com/photo-1541961017774-22349e4a1262?auto=format&fit=crop&q=80&w=800";
  if (type === "text") return "新文字";
  if (type === "partition") return "#f3f4f6";
  if (type === "lightstrip") return "#ffe08a";
  if (type === "flower") return "#ec4899";
  if (type === "chandelier") return "#fde68a";
  if (type === "bench") return "#8b5e3c";
  if (type === "rug") return "#1d4ed8";
  if (type === "vase") return "#38bdf8";
  if (type === "sculpture") return "#9ca3af";
  if (type === "spotlight") return "#fff3b0";
  if (type === "plant") return "#22c55e";
  if (type === "column") return "#cbd5e1";
  if (type === "neon") return "#22d3ee";
  return "";
}

export function createDefaultItem(type: ExhibitItem["type"], roomSize: RoomSize, options?: { position?: [number, number, number]; rotation?: [number, number, number] }): ExhibitItem {
  return {
    id: uuidv4(),
    type,
    position: options?.position || (type === "partition" ? [0, roomSize.height / 2, 0] : [0, 1.5, 0]),
    rotation: options?.rotation || [0, 0, 0],
    scale: getDefaultItemScale(type, roomSize),
    content: getDefaultItemContent(type),
    title: type === "painting" ? "新作品" : undefined,
    artist: type === "painting" ? "未知作者" : undefined,
    description: type === "painting" ? "作品描述。" : undefined,
    externalUrl: type === "painting" ? "" : undefined,
    frameWidth: type === "painting" ? 2 : undefined,
    frameHeight: type === "painting" ? 1.5 : undefined,
    textFontFamily: type === "text" ? "sans" : undefined,
    textColor: type === "text" ? "#111827" : undefined,
    textFontSize: type === "text" ? 0.5 : undefined,
    textIsBold: type === "text" ? false : undefined,
    textBackboardEnabled: type === "text" ? false : undefined,
    textBackboardColor: type === "text" ? "#ffffff" : undefined,
    lightIntensity: type === "lightstrip" ? 0.5 : undefined,
  };
}
