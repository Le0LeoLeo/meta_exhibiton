import { describe, expect, it } from "vitest";

import type { ExhibitItem } from "../types";
import {
  createWorldItemCollider,
  resolvePlayerCircle,
  resolvePlayerCircleAgainstCollider,
  type WorldItemCollider,
} from "./itemCollision";

function item(
  overrides: Partial<ExhibitItem> = {},
): ExhibitItem {
  return {
    id: "bench-1",
    type: "bench",
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    content: "",
    ...overrides,
  };
}

function collider(
  overrides: Partial<WorldItemCollider> = {},
): WorldItemCollider {
  return {
    itemId: "item-1",
    center: { x: 0, z: 0 },
    halfSize: { x: 1, z: 0.5 },
    rotationY: 0,
    minY: 0,
    maxY: 1,
    solid: true,
    ...overrides,
  };
}

describe("createWorldItemCollider", () => {
  it("applies item translation, yaw, scale, and collider offset", () => {
    const world = createWorldItemCollider(item({
      position: [10, 2, 20],
      rotation: [0, Math.PI / 2, 0],
      scale: [2, 3, 0.5],
    }));

    // Bench metadata: size [1.8, .9, .65], offset [0, .45, 0].
    expect(world.center.x).toBeCloseTo(10);
    expect(world.center.z).toBeCloseTo(20);
    expect(world.halfSize.x).toBeCloseTo(1.8);
    expect(world.halfSize.z).toBeCloseTo(0.1625);
    expect(world.minY).toBeCloseTo(2);
    expect(world.maxY).toBeCloseTo(4.7);
    expect(world.rotationY).toBeCloseTo(Math.PI / 2);
    expect(world.solid).toBe(true);
  });

  it("preserves non-solid metadata and projects tilt into vertical bounds", () => {
    const world = createWorldItemCollider(item({
      id: "rug-1",
      type: "rug",
      position: [0, 1, 0],
      rotation: [Math.PI / 2, 0, 0],
    }));

    expect(world.solid).toBe(false);
    expect(world.minY).toBeCloseTo(0.2);
    expect(world.maxY).toBeCloseTo(1.8);
    expect(world.halfSize.z).toBeCloseTo(0.025);
  });

  it("keeps local half sizes stable at a non-right-angle yaw", () => {
    const world = createWorldItemCollider(item({
      rotation: [0, Math.PI / 4, 0],
    }));

    expect(world.halfSize.x).toBeCloseTo(0.9);
    expect(world.halfSize.z).toBeCloseTo(0.325);
  });
});

describe("resolvePlayerCircleAgainstCollider", () => {
  it("pushes an outside circle to the nearest face", () => {
    const resolved = resolvePlayerCircleAgainstCollider(
      { x: 1.2, z: 0, radius: 0.35, minY: 0, maxY: 1.8 },
      collider(),
    );

    expect(resolved.collided).toBe(true);
    expect(resolved.x).toBeCloseTo(1.35);
    expect(resolved.z).toBeCloseTo(0);
  });

  it("resolves a circle that starts inside a rotated collider", () => {
    const resolved = resolvePlayerCircleAgainstCollider(
      { x: 0, z: 0, radius: 0.25, minY: 0, maxY: 1.8 },
      collider({ rotationY: Math.PI / 2 }),
    );

    expect(resolved.collided).toBe(true);
    expect(resolved.x).toBeCloseTo(0.75);
    expect(resolved.z).toBeCloseTo(0);
  });

  it("ignores non-solid and vertically disjoint colliders", () => {
    const player = { x: 0, z: 0, radius: 0.35, minY: 1.1, maxY: 1.8 };

    expect(resolvePlayerCircleAgainstCollider(
      player,
      collider({ solid: false }),
    ).collided).toBe(false);
    expect(resolvePlayerCircleAgainstCollider(
      player,
      collider({ minY: 0, maxY: 1.1 }),
    ).collided).toBe(false);
  });
});

describe("resolvePlayerCircle", () => {
  it("iterates across multiple colliders and reports a collision", () => {
    const resolved = resolvePlayerCircle(
      { x: 0.9, z: 0.4, radius: 0.25, minY: 0, maxY: 1.8 },
      [
        collider(),
        collider({
          itemId: "item-2",
          center: { x: 1.25, z: 0.75 },
          halfSize: { x: 0.5, z: 0.5 },
        }),
      ],
    );

    expect(resolved.collided).toBe(true);
    for (const value of [resolved.x, resolved.z]) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });
});
