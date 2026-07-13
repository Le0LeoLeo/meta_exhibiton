import type { ReactNode } from "react";

import type { AppMode, ExhibitItem } from "../types";

export type ExhibitRendererProps = {
  item: ExhibitItem;
  isSelected: boolean;
  mode: AppMode;
  onInteract?: (event: unknown) => void;
};

export type ExhibitRenderer = (props: ExhibitRendererProps) => ReactNode;

export function createExhibitRegistry<T extends Record<ExhibitItem["type"], ExhibitRenderer>>(registry: T): T {
  return registry;
}
