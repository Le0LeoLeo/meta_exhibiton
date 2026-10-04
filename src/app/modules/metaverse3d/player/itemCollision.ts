import * as THREE from "three";

import { getItemBehavior } from "../items/itemBehaviorRegistry";
import { getTemplateDisplay } from '../items/templateDisplay';
import type { ExhibitItem } from "../types";

export type WorldItemCollider = {
  itemId: string;
  center: { x: number; z: number };
  halfSize: { x: number; z: number };
  rotationY: number;
  minY: number;
  maxY: number;
  solid: boolean;
};

export type PlayerCircle = {
  x: number;
  z: number;
  radius: number;
  minY: number;
  maxY: number;
};

export type ResolvedPlayerCircle = {
  x: number;
  z: number;
  collided: boolean;
};

const EPSILON = 1e-9;

function verticalRangesOverlap(
  minA: number,
  maxA: number,
  minB: number,
  maxB: number,
) {
  return maxA > minB + EPSILON && minA < maxB - EPSILON;
}

/**
 * Converts an item's local collider metadata into a world-space yaw-oriented
 * bounding box. Pitch and roll are conservatively projected into that OBB, so
 * tilted items remain blocking without requiring a full 3D physics engine.
 */
export function createWorldItemCollider(
  item: ExhibitItem,
): WorldItemCollider {
  const display = getTemplateDisplay(item);
  const metadata = display ? {
    size: [Math.max(display.size[0], display.modelSize), display.totalHeight, display.size[2]],
    offset: [0, display.totalHeight / 2, 0], solid: true,
  } : getItemBehavior(item.type).collider;
  const [sizeX, sizeY, sizeZ] = metadata.size;
  const [offsetX, offsetY, offsetZ] = metadata.offset;
  const [positionX, positionY, positionZ] = item.position;
  const [rotationX, rotationY, rotationZ] = item.rotation;
  const [scaleX, scaleY, scaleZ] = item.scale;

  const transform = new THREE.Matrix4().compose(
    new THREE.Vector3(positionX, positionY, positionZ),
    new THREE.Quaternion().setFromEuler(
      new THREE.Euler(rotationX, rotationY, rotationZ, "XYZ"),
    ),
    new THREE.Vector3(scaleX, scaleY, scaleZ),
  );

  const cosY = Math.cos(rotationY);
  const sinY = Math.sin(rotationY);
  let minLocalX = Number.POSITIVE_INFINITY;
  let maxLocalX = Number.NEGATIVE_INFINITY;
  let minLocalZ = Number.POSITIVE_INFINITY;
  let maxLocalZ = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const xSign of [-1, 1]) {
    for (const ySign of [-1, 1]) {
      for (const zSign of [-1, 1]) {
        const corner = new THREE.Vector3(
          offsetX + xSign * sizeX / 2,
          offsetY + ySign * sizeY / 2,
          offsetZ + zSign * sizeZ / 2,
        ).applyMatrix4(transform);
        const relativeX = corner.x - positionX;
        const relativeZ = corner.z - positionZ;
        const localX = relativeX * cosY - relativeZ * sinY;
        const localZ = relativeX * sinY + relativeZ * cosY;

        minLocalX = Math.min(minLocalX, localX);
        maxLocalX = Math.max(maxLocalX, localX);
        minLocalZ = Math.min(minLocalZ, localZ);
        maxLocalZ = Math.max(maxLocalZ, localZ);
        minY = Math.min(minY, corner.y);
        maxY = Math.max(maxY, corner.y);
      }
    }
  }

  const centerLocalX = (minLocalX + maxLocalX) / 2;
  const centerLocalZ = (minLocalZ + maxLocalZ) / 2;
  const worldCosY = Math.cos(rotationY);
  const worldSinY = Math.sin(rotationY);

  return {
    itemId: item.id,
    center: {
      x: positionX + centerLocalX * worldCosY + centerLocalZ * worldSinY,
      z: positionZ - centerLocalX * worldSinY + centerLocalZ * worldCosY,
    },
    halfSize: {
      x: (maxLocalX - minLocalX) / 2,
      z: (maxLocalZ - minLocalZ) / 2,
    },
    rotationY,
    minY,
    maxY,
    solid: metadata.solid,
  };
}

export function createWorldItemColliders(
  items: ExhibitItem[],
): WorldItemCollider[] {
  return items.map(createWorldItemCollider);
}

/**
 * Resolves one player circle against one OBB. Non-solid colliders and
 * vertically disjoint volumes are intentionally ignored.
 */
export function resolvePlayerCircleAgainstCollider(
  player: PlayerCircle,
  collider: WorldItemCollider,
): ResolvedPlayerCircle {
  if (
    !collider.solid ||
    player.radius <= 0 ||
    !verticalRangesOverlap(
      player.minY,
      player.maxY,
      collider.minY,
      collider.maxY,
    )
  ) {
    return { x: player.x, z: player.z, collided: false };
  }

  const relativeX = player.x - collider.center.x;
  const relativeZ = player.z - collider.center.z;
  const cosY = Math.cos(collider.rotationY);
  const sinY = Math.sin(collider.rotationY);
  let localX = relativeX * cosY - relativeZ * sinY;
  let localZ = relativeX * sinY + relativeZ * cosY;
  const closestX = THREE.MathUtils.clamp(
    localX,
    -collider.halfSize.x,
    collider.halfSize.x,
  );
  const closestZ = THREE.MathUtils.clamp(
    localZ,
    -collider.halfSize.z,
    collider.halfSize.z,
  );
  const deltaX = localX - closestX;
  const deltaZ = localZ - closestZ;
  const distanceSquared = deltaX * deltaX + deltaZ * deltaZ;

  if (distanceSquared >= player.radius * player.radius) {
    return { x: player.x, z: player.z, collided: false };
  }

  if (distanceSquared > EPSILON) {
    const distance = Math.sqrt(distanceSquared);
    const push = player.radius - distance;
    localX += deltaX / distance * push;
    localZ += deltaZ / distance * push;
  } else {
    const exits = [
      {
        distance: collider.halfSize.x - localX + player.radius,
        x: collider.halfSize.x + player.radius,
        z: localZ,
      },
      {
        distance: collider.halfSize.x + localX + player.radius,
        x: -collider.halfSize.x - player.radius,
        z: localZ,
      },
      {
        distance: collider.halfSize.z - localZ + player.radius,
        x: localX,
        z: collider.halfSize.z + player.radius,
      },
      {
        distance: collider.halfSize.z + localZ + player.radius,
        x: localX,
        z: -collider.halfSize.z - player.radius,
      },
    ];
    const nearestExit = exits.reduce((nearest, candidate) =>
      candidate.distance < nearest.distance ? candidate : nearest,
    );
    localX = nearestExit.x;
    localZ = nearestExit.z;
  }

  const worldCosY = Math.cos(collider.rotationY);
  const worldSinY = Math.sin(collider.rotationY);
  return {
    x:
      collider.center.x +
      localX * worldCosY +
      localZ * worldSinY,
    z:
      collider.center.z -
      localX * worldSinY +
      localZ * worldCosY,
    collided: true,
  };
}

/**
 * Iteratively resolves a circle against all colliders so corners formed by
 * multiple objects settle without depending on a single pass.
 */
export function resolvePlayerCircle(
  player: PlayerCircle,
  colliders: WorldItemCollider[],
  maxIterations = 4,
): ResolvedPlayerCircle {
  let x = player.x;
  let z = player.z;
  let collided = false;
  const iterations = Math.max(1, Math.floor(maxIterations));

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let movedThisIteration = false;
    for (const collider of colliders) {
      const resolved = resolvePlayerCircleAgainstCollider(
        { ...player, x, z },
        collider,
      );
      if (!resolved.collided) continue;
      x = resolved.x;
      z = resolved.z;
      collided = true;
      movedThisIteration = true;
    }
    if (!movedThisIteration) break;
  }

  return { x, z, collided };
}
