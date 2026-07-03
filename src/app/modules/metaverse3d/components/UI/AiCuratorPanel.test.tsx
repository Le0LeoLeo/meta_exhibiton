import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CuratorPlanResponse } from "@/app/api/aiCurator";
import type { SceneSnapshot } from "../../aiCurator/mapCuratorPlanToScene";
import { AiCuratorPanel } from "./AiCuratorPanel";

const text = {
  theme: "\u5c55\u89bd\u4e3b\u984c",
  generate: "\u751f\u6210\u7b56\u5c55\u65b9\u6848",
  preserveExisting: "\u4fdd\u7559\u73fe\u6709\u5c55\u54c1",
  preserveWarning: "\u5373\u5c07\u4fdd\u7559\u73fe\u6709\u5c55\u54c1\u4e26\u52a0\u5165 AI \u8349\u7a3f",
  applyToScene: "\u5957\u7528\u5230\u5c55\u5ef3",
  confirmApply: "\u78ba\u8a8d\u5957\u7528",
  title: "\u6fb3\u9580\u975e\u907a\u6587\u5316\u5c55",
  counts: "1 \u500b\u5c55\u5340 / 1 \u4ef6\u5c55\u54c1",
};

const plan: CuratorPlanResponse = {
  source: "fallback",
  exhibition: {
    title: text.title,
    introduction: "\u4ee5\u624b\u85dd\u3001\u7bc0\u6176\u8207\u8857\u5340\u8a18\u61b6\u69cb\u6210\u7684\u5c55\u89bd\u3002",
    guideOpening: "\u6b61\u8fce\u4f86\u5230\u6fb3\u9580\u975e\u907a\u6587\u5316\u5c55\u3002",
    sections: [
      { id: "section-01", title: "\u624b\u85dd", summary: "\u770b\u898b\u5de5\u85dd\u8207\u57ce\u5e02\u8a18\u61b6\u3002" },
    ],
    exhibits: [
      {
        id: "exhibit-01",
        sectionId: "section-01",
        title: "\u6728\u96d5\u62db\u724c",
        description: "\u8857\u89d2\u62db\u724c\u3002",
        medium: "text",
        placementHint: "left-wall",
      },
    ],
  },
  warnings: [],
};

const currentScene: SceneSnapshot = {
  roomSize: {
    width: 12,
    length: 18,
    height: 4.5,
    wallThickness: 0.1,
    wallColor: "#ffffff",
    wallMaterialPreset: "paint",
    wallTextureUrl: "",
    wallTextureTiling: 1,
    wallRoughness: 0.5,
    wallMetalness: 0,
    wallBumpScale: 0,
    wallEnvIntensity: 1,
    wallOpacity: 1,
    wallTransmission: 0,
    wallIor: 1.45,
    floorColor: "#111111",
    floorTextureUrl: "",
    floorTextureTiling: 1,
    floorRoughness: 0.6,
    floorMetalness: 0,
    environmentBrightness: 0.7,
  },
  items: [
    {
      id: "existing-painting",
      type: "painting",
      position: [1, 1.5, 2],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      content: "/uploads/existing.jpg",
    },
  ],
  floorPlanElements: [],
  wallMaterialOverrides: {},
};

afterEach(() => {
  cleanup();
});

describe("AiCuratorPanel", () => {
  it("generates a preview and applies only after inline confirmation", async () => {
    const requestCuratorPlan = vi.fn().mockResolvedValue(plan);
    const importScene = vi.fn();
    const onApplied = vi.fn();

    render(
      <AiCuratorPanel
        token="token-1"
        currentScene={currentScene}
        importScene={importScene}
        onApplied={onApplied}
        requestCuratorPlan={requestCuratorPlan}
      />,
    );

    fireEvent.change(screen.getByLabelText(text.theme), {
      target: { value: text.title },
    });
    fireEvent.click(screen.getByLabelText(text.preserveExisting));
    fireEvent.click(screen.getByRole("button", { name: text.generate }));

    await screen.findByText(text.title);
    expect(importScene).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: text.applyToScene }));
    expect(importScene).not.toHaveBeenCalled();
    expect(screen.getByText(text.preserveWarning)).toBeInTheDocument();
    expect(screen.getByText(text.counts)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: text.confirmApply }));
    expect(importScene).toHaveBeenCalledTimes(1);
    expect(importScene.mock.calls[0][0].items.some((item: { id: string }) => item.id === "existing-painting")).toBe(true);
    expect(onApplied).toHaveBeenCalledTimes(1);
  });

  it("shows an error without applying a scene", async () => {
    const requestCuratorPlan = vi.fn().mockRejectedValue(new Error("network failed"));
    const importScene = vi.fn();

    render(
      <AiCuratorPanel
        token="token-1"
        currentScene={null}
        importScene={importScene}
        requestCuratorPlan={requestCuratorPlan}
      />,
    );

    fireEvent.change(screen.getByLabelText(text.theme), {
      target: { value: text.title },
    });
    fireEvent.click(screen.getByRole("button", { name: text.generate }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("network failed"));
    expect(importScene).not.toHaveBeenCalled();
  });
});
