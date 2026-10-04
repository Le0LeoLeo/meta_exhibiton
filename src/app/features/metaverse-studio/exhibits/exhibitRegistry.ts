import type { ReactNode } from "react";
import type { ThreeEvent } from "@react-three/fiber";

import type { AppMode, ExhibitItem } from "../types";
import type { ExhibitModelQuality } from "./exhibitModelOptimization";
import type { SceneSnapshot } from "../../../modules/metaverse3d/store/metaverseStoreTypes";

export type ExhibitRendererProps = {
  item: ExhibitItem;
  sceneOverride?: SceneSnapshot | null;
  isSelected: boolean;
  mode: AppMode;
  quality: ExhibitModelQuality;
  onInteract?: (event: ThreeEvent<MouseEvent>) => void;
};

export type ExhibitRenderer = (props: ExhibitRendererProps) => ReactNode;

export function createExhibitRegistry<T extends Record<ExhibitItem["type"], ExhibitRenderer>>(registry: T): T {
  return registry;
}
