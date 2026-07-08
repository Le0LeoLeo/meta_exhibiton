import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requestBuilderReview, requestBuilderSession } from "../../../../api/exhibitionScene";
import { useStore } from "../../store/useStore";
import { EditUI } from "./EditUI";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);

vi.mock("../../../../api/exhibitionScene", () => ({
  requestBuilderSession: vi.fn(),
  requestBuilderReview: vi.fn(),
  requestBuilderRevision: vi.fn(),
}));

vi.mock("../../../../api/client", async () => {
  const actual = await vi.importActual<typeof import("../../../../api/client")>("../../../../api/client");
  return {
    ...actual,
    loadAuth: () => ({ token: "jwt-token", user: { id: "user-1" } }),
    generateGuideTts: vi.fn(),
  };
});

vi.mock("../../network/socketClient", () => ({
  emitChatMessage: vi.fn(),
}));

vi.mock("../../aiBuilder/captureInspectionScreenshots", () => ({
  captureBuilderInspectionScreenshots: vi.fn().mockResolvedValue([
    { viewId: "entrance", label: "Entrance", dataUrl: "data:image/png;base64,aaa" },
    { viewId: "left-wall", label: "Left wall", dataUrl: "data:image/png;base64,bbb" },
    { viewId: "top-down", label: "Top", dataUrl: "data:image/png;base64,ccc" },
  ]),
}));

function renderEditUI(items: any[] = []) {
  useStore.setState({
    mode: "edit",
    items,
    selectedItemId: null,
    selectedItemIds: [],
    selectedWallFace: null,
    selectedWallSegmentId: null,
    wallMaterialOverrides: {},
    undoStack: [],
    redoStack: [],
    pendingPlacement: null,
  });

  return render(
    <MemoryRouter>
      <EditUI />
    </MemoryRouter>,
  );
}

describe("EditUI AI builder", () => {
  const generatedScene = {
    roomSize: {
      width: 20,
      length: 16,
      height: 6,
      wallThickness: 0.1,
      wallColor: "#f8fafc",
      wallMaterialPreset: "paint",
      wallTextureUrl: "/textures/wall-paint.svg",
      wallTextureTiling: 3,
      wallRoughness: 0.35,
      wallMetalness: 0.08,
      wallBumpScale: 0.04,
      wallEnvIntensity: 0.9,
      wallOpacity: 0.98,
      wallTransmission: 0,
      wallIor: 1.45,
      floorColor: "#0f172a",
      floorTextureUrl: "/textures/wall-concrete.svg",
      floorTextureTiling: 2.5,
      floorRoughness: 0.55,
      floorMetalness: 0.18,
      environmentBrightness: 0.45,
    },
    items: [],
    floorPlanElements: [],
    wallMaterialOverrides: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requestBuilderSession).mockResolvedValue({
      sessionId: "builder-1",
      versionId: "version-1",
      status: "generated",
      exhibition: {
        title: "城市記憶展",
        curatorialStatement: "從街巷紋理走向未來想像。",
        sections: [],
      },
      scene: generatedScene,
      warnings: ["已使用示範展品補足空間。"],
      source: "qwen",
    });
    vi.mocked(requestBuilderReview).mockResolvedValue({
      sessionId: "builder-1",
      versionId: "version-1",
      status: "reviewed",
      review: {
        technicalScore: 90,
        curatorialScore: 86,
        overallStatus: "pass",
        blockingIssues: [],
        viewReviews: [],
        revisionPrompt: "Looks good.",
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("counts only artwork items in the top bar exhibit total", () => {
    renderEditUI([
      { id: "painting-1", type: "painting", position: [0, 2, -4], rotation: [0, 0, 0], scale: [1, 1, 1] },
      { id: "label-1", type: "text", position: [0, 1, -4], rotation: [0, 0, 0], scale: [1, 1, 1] },
      { id: "light-1", type: "lightstrip", position: [0, 3, -4], rotation: [0, 0, 0], scale: [1, 1, 1] },
      { id: "bench-1", type: "bench", position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    ]);

    expect(screen.getByText("展品 1")).toBeInTheDocument();
    expect(screen.queryByText("展品 4")).not.toBeInTheDocument();
  });

  it("previews a generated scene and imports it only after confirmation", async () => {
    const importScene = vi.spyOn(useStore.getState(), "importScene");
    renderEditUI();

    fireEvent.click(screen.getByRole("button", { name: /更多/ }));
    fireEvent.click(screen.getByRole("button", { name: "AI 建展" }));
    const promptInput = document.querySelector("textarea");
    expect(promptInput).toBeTruthy();
    fireEvent.change(promptInput as HTMLTextAreaElement, {
      target: { value: "建立一個關於澳門城市記憶的展覽" },
    });
    fireEvent.click(screen.getByRole("button", { name: "生成展覽" }));

    await waitFor(() => {
      expect(requestBuilderSession).toHaveBeenCalledWith(
        "jwt-token",
        expect.objectContaining({
          prompt: "建立一個關於澳門城市記憶的展覽",
        }),
      );
    });

    expect(importScene).not.toHaveBeenCalled();
    expect(await screen.findByText("預覽生成結果")).toBeInTheDocument();
    expect(screen.getByText("城市記憶展")).toBeInTheDocument();
    expect(screen.getByText("從街巷紋理走向未來想像。")).toBeInTheDocument();
    expect(screen.getByText("來源")).toBeInTheDocument();
    expect(screen.getByText("qwen")).toBeInTheDocument();
    expect(screen.getByText("提醒")).toBeInTheDocument();
    expect(screen.getByText("已使用示範展品補足空間。")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "套用生成展覽" }));

    await waitFor(() => expect(importScene).toHaveBeenCalledWith(generatedScene));
  }, 15_000);

  it("clears the previous preview when a new generation starts", async () => {
    renderEditUI();

    fireEvent.click(screen.getByRole("button", { name: /更多/ }));
    fireEvent.click(screen.getByRole("button", { name: "AI 建展" }));
    const promptInput = document.querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.change(promptInput, {
      target: { value: "建立一個關於澳門城市記憶的展覽" },
    });
    fireEvent.click(screen.getByRole("button", { name: "生成展覽" }));

    expect(await screen.findByText("預覽生成結果")).toBeInTheDocument();
    expect(screen.getByText("城市記憶展")).toBeInTheDocument();

    vi.mocked(requestBuilderSession).mockRejectedValueOnce(new Error("生成失敗"));
    fireEvent.change(promptInput, {
      target: { value: "改成另一個展覽" },
    });
    fireEvent.click(screen.getByRole("button", { name: "生成展覽" }));

    await waitFor(() => expect(requestBuilderSession).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("城市記憶展")).not.toBeInTheDocument();
  }, 15_000);

  it("temporarily imports the preview scene while capturing a VL review", async () => {
    const originalScene = useStore.getState().exportScene();
    const importScene = vi.spyOn(useStore.getState(), "importScene");
    renderEditUI();

    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    fireEvent.click(screen.getByRole("button", { name: "AI 建展" }));
    const promptInput = document.querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.change(promptInput, {
      target: { value: "Build a Macau memory exhibition" },
    });
    fireEvent.click(screen.getByRole("button", { name: "生成展覽" }));

    fireEvent.click(await screen.findByRole("button", { name: "VL 自檢" }));

    await waitFor(() => expect(requestBuilderReview).toHaveBeenCalled());
    expect(importScene).toHaveBeenCalledWith(generatedScene);
    expect(importScene).toHaveBeenLastCalledWith(originalScene);
  }, 15_000);
});
