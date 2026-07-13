import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

describe("StudioExhibitItem", () => {
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

    render(<StudioExhibitItem item={item} />);

    expect(screen.getByTestId("studio-text")).toHaveAttribute("data-font-size", "0.22");
    expect(screen.getByTestId("studio-text")).toHaveAttribute("data-color", "#f8fafc");
    expect(screen.getByTestId("studio-text-backboard")).toHaveAttribute("data-color", "#111827");
  });
});
