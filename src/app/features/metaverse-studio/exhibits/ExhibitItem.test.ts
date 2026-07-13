import { describe, expect, it } from "vitest";

import type { ExhibitItem } from "../../types";
import { hasRemoteEditorFocus, resolvePaintingImageUrl } from "./ExhibitItem";

function painting(overrides: Partial<ExhibitItem>): ExhibitItem {
  return {
    id: "painting-01",
    type: "painting",
    position: [0, 2.5, -9.8],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    content: "",
    ...overrides,
  };
}

describe("resolvePaintingImageUrl", () => {
  it("uses generated remote image URLs instead of the shared fallback", () => {
    const url = "https://images.unsplash.com/photo-1541961017774-22349e4a1262?auto=format&fit=crop&q=80&w=1200";

    expect(resolvePaintingImageUrl(painting({ content: url }), "fallback.jpg")).toBe(url);
  });
});

describe("hasRemoteEditorFocus", () => {
  it("recognizes an item focused by another editor", () => {
    expect(hasRemoteEditorFocus({ editor: { itemId: "painting-01" } }, "painting-01"))
      .toBe(true);
    expect(hasRemoteEditorFocus({ editor: { itemId: "painting-01" } }, "painting-02"))
      .toBe(false);
  });
});
