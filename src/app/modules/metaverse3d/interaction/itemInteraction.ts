import type { ExhibitItem } from "../types";
import {
  getItemBehavior,
  type ItemInteractionKind,
  type Vec3,
} from "../items/itemBehaviorRegistry";

export type { ItemInteractionKind };

export type ItemInteractionDescriptor = {
  id: string;
  title: string;
  prompt: string;
  kind: ItemInteractionKind;
  defaultActive: boolean;
};

type InteractableItem = Pick<
  ExhibitItem,
  "id" | "type" | "title" | "fileName" | "position" | "rotation" | "scale"
>;

// The casual avatar's eye is about 0.93 m above its hip-bone center. The
// additional clearance accounts for the visible pelvis volume. This value is
// calibrated at the contact point: lower clips through the cushion, higher
// leaves a visible gap from side views.
export const SEATED_EYE_ABOVE_SURFACE = 1.01;

export function getItemDisplayName(
  item: Pick<InteractableItem, "title" | "fileName" | "type">,
) {
  return item.title?.trim() || item.fileName?.trim() || String(item.type);
}

export function getItemInteraction(
  item: InteractableItem,
  active?: boolean,
): ItemInteractionDescriptor | null {
  const interaction = getItemBehavior(item.type).interaction;
  if (!interaction) return null;

  const title = getItemDisplayName(item);
  const defaultActive = interaction.kind === "toggle-light";
  return {
    id: item.id,
    title,
    prompt: active && interaction.activePrompt
      ? interaction.activePrompt
      : interaction.prompt,
    kind: interaction.kind,
    defaultActive,
  };
}

function transformLocalAnchor(
  anchor: Vec3,
  item: Pick<InteractableItem, "position" | "rotation" | "scale">,
) {
  const [x, y, z] = item.position;
  const [, yaw = 0] = item.rotation;
  const [scaleX = 1, scaleY = 1, scaleZ = 1] = item.scale;
  const localX = anchor[0] * scaleX;
  const localY = anchor[1] * scaleY;
  const localZ = anchor[2] * scaleZ;
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);

  return [
    x + localX * cos + localZ * sin,
    y + localY,
    z - localX * sin + localZ * cos,
  ] as [number, number, number];
}

export function getSeatPose(
  item: Pick<InteractableItem, "type" | "position" | "rotation" | "scale">,
) {
  const interaction = getItemBehavior(item.type).interaction;
  const [, yaw = 0] = item.rotation;
  const anchor = interaction?.seatAnchor ?? [0, 0.5, 0];
  const position = transformLocalAnchor(anchor, item);
  position[1] += SEATED_EYE_ABOVE_SURFACE;

  return {
    position,
    yaw: yaw + Math.PI,
  };
}

export function getSeatExitPosition(
  item: Pick<InteractableItem, "type" | "position" | "rotation" | "scale">,
  eyeHeight: number,
) {
  const interaction = getItemBehavior(item.type).interaction;
  const anchor = interaction?.exitAnchor ?? [0, 0, 1];
  const position = transformLocalAnchor(anchor, item);
  position[1] = eyeHeight;
  return position;
}
