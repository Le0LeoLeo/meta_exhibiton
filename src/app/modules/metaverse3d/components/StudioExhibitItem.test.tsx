import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ExhibitItem, RoomSize } from "../types";
import { useMetaverseStudioStore } from "../store/useMetaverseStudioStore";
import { StudioExhibitItem } from "./StudioExhibitItem";

vi.mock("@react-three/drei", () => ({
  Text: ({ children, color, fontSize, maxWidth }: any) => (
    <span
      data-testid="studio-text"
      data-color={color}
      data-font-size={fontSize}
      data-max-width={maxWidth}
    >
      {children}
    </span>
  ),
  TransformControls: () => null,
  useGLTF: () => ({ scene: { clone: () => ({}) } }),
}));

const roomSize = {
  width: 24,
  length: 20,
  height: 6,
} as RoomSize;

afterEach(cleanup);

describe("StudioExhibitItem", () => {
  it("builds a painting from four physical rails with optional mat and glass", () => {
    useMetaverseStudioStore.setState({
      mode: "edit",
      roomSize,
      selectedItemId: null,
      setSelectedItemId: vi.fn(),
      updateItem: vi.fn(),
    });

    const item = {
      id: "painting-framed",
      type: "painting",
      position: [0, 2, -9.8],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      content: "https://example.com/art.jpg",
      frameWidth: 2,
      frameHeight: 1.5,
      frameStyle: "metal",
      frameMatEnabled: true,
      frameMatColor: "#f7f7f4",
      frameGlassEnabled: true,
    } satisfies ExhibitItem;

    const { container } = render(<StudioExhibitItem item={item} />);

    expect(container.querySelector('[name="painting-frame"]')).toBeInTheDocument();
    expect(container.querySelectorAll('[name="painting-frame-rail"]')).toHaveLength(4);
    expect(container.querySelector('[name="painting-frame-mat"]')).toBeInTheDocument();
    expect(container.querySelector('[name="painting-frame-glass"]')).toBeInTheDocument();
    expect(container.querySelector('[name="painting-frame-accent"]')).toBeInTheDocument();
    // DOM data-* attributes are invalid pierced properties on Three.js objects.
    expect(container.querySelector('mesh[data-testid], group[data-testid]')).toBeNull();
  });

  it("renders generated text with its configured scale and backboard", () => {
    useMetaverseStudioStore.setState({
      mode: "edit",
      roomSize,
      selectedItemId: null,
      setSelectedItemId: vi.fn(),
      updateItem: vi.fn(),
    });

    const item = {
      id: "ai-curatorial-statement",
      type: "text",
      position: [0, 3.65, 9.8],
      rotation: [0, Math.PI, 0],
      scale: [1, 1, 1],
      content: "城市記憶\n空間敘事",
      textColor: "#f8fafc",
      textFontSize: 0.22,
      textBackboardEnabled: true,
      textBackboardColor: "#111827",
    } satisfies ExhibitItem;

    const { container } = render(<StudioExhibitItem item={item} />);

    expect(screen.getByTestId("studio-text")).toHaveAttribute("data-font-size", "0.22");
    expect(screen.getByTestId("studio-text")).toHaveAttribute("data-color", "#f8fafc");
    expect(container.querySelector('[name="studio-text-backboard"] meshStandardMaterial')).toHaveAttribute("color", "#111827");
  });
});
