import { describe, expect, it } from "vitest";
import type { ExhibitItem } from "../types";
import { toExhibitData } from "./behaviorHelpers";

describe("agent exhibit context", () => {
  it("retains all eligible scene geometry for attention and navigation", () => {
    const paintings: ExhibitItem[] = Array.from({ length: 9 }, (_, index) => ({
      id: `painting-${index}`,
      type: "painting",
      position: [index, 2, 0],
      rotation: [0, Math.PI / 2, 0],
      scale: [2, 1, 1],
      content: "",
    }));
    const result = toExhibitData([{ ...paintings[0], id: "wall", type: "partition" }, ...paintings]);
    expect(result.map((item) => item.id)).toEqual(paintings.map((item) => item.id));
    expect(result[0]).toEqual(paintings[0]);
  });
});
