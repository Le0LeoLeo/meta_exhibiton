import { v4 as uuidv4 } from "uuid";
import type { ExhibitItem, RoomSize } from "../types";
import type { AddItemOptions } from './metaverseStoreTypes';
import {
  getItemBehavior,
  resolveItemDefaultScale,
  resolveItemPlacementY,
} from "../items/itemBehaviorRegistry";

function getDefaultItemScale(type: ExhibitItem["type"], roomSize: RoomSize): [number, number, number] {
  return [...resolveItemDefaultScale(type, roomSize)];
}

function getDefaultItemContent(type: ExhibitItem["type"]): string {
  return getItemBehavior(type).defaultContent;
}

export function createDefaultItem(type: ExhibitItem["type"], roomSize: RoomSize, options?: AddItemOptions): ExhibitItem {
  return {
    id: uuidv4(),
    type,
    position: options?.position ? [...options.position] : [0, resolveItemPlacementY(type, roomSize), 0],
    rotation: options?.rotation ? [...options.rotation] : [0, 0, 0],
    scale: options?.scale ? [...options.scale] : getDefaultItemScale(type, roomSize),
    content: options?.content ?? getDefaultItemContent(type),
    modelOffset: options?.modelOffset ? [...options.modelOffset] : undefined,
    title: options?.title ?? (type === "painting" ? "新作品" : undefined),
    artist: type === "painting" ? "未知作者" : undefined,
    description: type === "painting" ? "作品描述。" : undefined,
    externalUrl: type === "painting" ? "" : undefined,
    frameWidth: type === "painting" ? 2 : undefined,
    frameHeight: type === "painting" ? 1.5 : undefined,
    frameStyle: type === "painting" ? "modern" : undefined,
    frameColor: type === "painting" ? "#17191d" : undefined,
    frameInnerColor: type === "painting" ? "#6b7280" : undefined,
    frameThickness: type === "painting" ? 0.09 : undefined,
    frameDepth: type === "painting" ? 0.08 : undefined,
    frameMatEnabled: type === "painting" ? false : undefined,
    frameMatColor: type === "painting" ? "#f5f2ea" : undefined,
    frameMatWidth: type === "painting" ? 0.12 : undefined,
    frameGlassEnabled: type === "painting" ? false : undefined,
    textFontFamily: type === "text" ? "sans" : undefined,
    textColor: type === "text" ? "#111827" : undefined,
    textFontSize: type === "text" ? 0.5 : undefined,
    textIsBold: type === "text" ? false : undefined,
    textBackboardEnabled: type === "text" ? false : undefined,
    textBackboardColor: type === "text" ? "#ffffff" : undefined,
    lightIntensity: type === "lightstrip" ? 0.5 : undefined,
  };
}
