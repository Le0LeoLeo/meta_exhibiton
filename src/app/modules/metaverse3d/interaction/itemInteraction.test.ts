import { describe, expect, it } from "vitest";

import type { ExhibitItem } from "../types";
import {
  getItemInteraction,
  getSeatExitPosition,
  getSeatPose,
} from "./itemInteraction";

function item(type: string, overrides: Partial<ExhibitItem> = {}) {
  return {
    id: `${type}-1`,
    type,
    title: "展示物",
    position: [1, 0, 2],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    content: "",
    ...overrides,
  } as ExhibitItem;
}

describe("item interactions", () => {
  it.each(["painting", "pedestal", "text", "sculpture"])(
    "keeps %s as a view interaction",
    (type) => {
      expect(getItemInteraction(item(type))).toMatchObject({ kind: "view" });
    },
  );

  it.each(["bench", "chair", "sofa"])("makes %s sittable", (type) => {
    expect(getItemInteraction(item(type))).toMatchObject({ kind: "sit" });
  });

  it.each([
    ["bench", [1, 1.55, 2.08]],
    ["chair", [1, 1.57, 2.13]],
    ["sofa", [1, 1.67, 2.17]],
  ] as const)("places the %s pelvis above its seat surface", (type, position) => {
    const actual = getSeatPose(item(type)).position;
    actual.forEach((value, index) => {
      expect(value).toBeCloseTo(position[index]);
    });
  });

  it("assigns the expected defaults to switches", () => {
    expect(getItemInteraction(item("lightstrip"))).toMatchObject({
      kind: "toggle-light",
      defaultActive: true,
    });
    expect(getItemInteraction(item("cabinet"))).toMatchObject({
      kind: "toggle-open",
      defaultActive: false,
    });
    expect(getItemInteraction(item("fountain"))).toMatchObject({
      kind: "toggle-motion",
      defaultActive: false,
    });
  });

  it("creates a rotated seated and exit pose", () => {
    const seat = item("bench", {
      rotation: [0, Math.PI / 2, 0],
      scale: [1, 2, 2],
    });

    expect(getSeatPose(seat)).toEqual({
      position: [1.16, 2.09, 2],
      yaw: (Math.PI * 3) / 2,
    });
    expect(getSeatExitPosition(seat, 1.7)).toEqual([3, 1.7, 2]);
  });
});
