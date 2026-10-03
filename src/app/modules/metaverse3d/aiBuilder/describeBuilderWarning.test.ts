import { describe, expect, it } from "vitest";
import { describeBuilderWarning } from "./describeBuilderWarning";

const items = [
  { id: "painting-tad8ti8o", title: "Under the Wave off Kanagawa", type: "painting" as const },
  { id: "painting-kf2m2dx4", title: "Noboto in Shimosa Province", type: "painting" as const },
  { id: "painting-kf2m2dx4-copy", title: "", type: "painting" as const },
];

describe("describeBuilderWarning", () => {
  it("names artworks by title instead of internal id", () => {
    expect(describeBuilderWarning(
      "Scene operation rejected; kept the existing scene. painting-tad8ti8o overlaps painting-kf2m2dx4, including captions/backboards.",
      items,
    )).toBe("Scene operation rejected; kept the existing scene. “Under the Wave off Kanagawa” overlaps “Noboto in Shimosa Province”, including captions/backboards.");
  });

  it("does not replace an id inside a longer id and falls back to the type", () => {
    expect(describeBuilderWarning("painting-kf2m2dx4-copy intersects wall north.", items)).toBe("the painting intersects wall north.");
  });

  it("leaves unknown ids untouched", () => {
    expect(describeBuilderWarning("text-unknown is outside the exhibition floor.", items)).toBe("text-unknown is outside the exhibition floor.");
  });
});
