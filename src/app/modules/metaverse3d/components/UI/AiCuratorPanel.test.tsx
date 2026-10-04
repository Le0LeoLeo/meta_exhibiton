import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CuratorPlanResponse } from "@/app/api/aiCurator";
import type { SceneSnapshot } from "../../aiCurator/mapCuratorPlanToScene";
import { AiCuratorPanel } from "./AiCuratorPanel";

const text = {
  theme: "\u5c55\u89bd\u4e3b\u984c",
  intent: "\u7b56\u5c55\u65b9\u5411",
  warmMemory: "\u6eab\u6696\u56de\u61b6",
  professionalGallery: "\u5c08\u696d\u5c55\u89bd",
  generate: "\u751f\u6210\u7b56\u5c55\u65b9\u6848",
  generating: "正在依主題整理策展文字草稿，目前不會改動展場。",
  preserveExisting: "\u4fdd\u7559\u73fe\u6709\u5c55\u54c1",
  preserveWarning: "保留現有展品及原來位置，另外加入 AI 草稿的展區文字、示例展品文字和燈光；請檢查是否與現有展品重疊。",
  preserveDetail: "保留：現有展品、已上傳媒體的引用及目前位置。",
  changeDetail: "新增：標題、展區與示例展品文字及燈光。AI 不會自動重排現有作品。",
  applyToScene: "\u5957\u7528\u5230\u5c55\u5ef3",
  confirmApply: "\u78ba\u8a8d\u5957\u7528",
  title: "\u6fb3\u9580\u975e\u907a\u6587\u5316\u5c55",
  counts: "1 個展區 / 1 則示例展品文字",
  unchangedError: "\u9019\u6b21\u6c92\u6709\u6210\u529f\u751f\u6210\u8a08\u5283\u3002\u4f60\u7684\u5c55\u5834\u4ecd\u7136\u4fdd\u6301\u539f\u72c0\uff0c\u53ef\u4ee5\u7a0d\u5f8c\u91cd\u8a66\u3002",
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
  it("sends the default warm-memory intent when generating without changing intent", async () => {
    const requestCuratorPlan = vi.fn().mockResolvedValue(plan);
    const importScene = vi.fn();

    render(
      <AiCuratorPanel
        token="token-1"
        currentScene={currentScene}
        importScene={importScene}
        requestCuratorPlan={requestCuratorPlan}
      />,
    );

    fireEvent.change(screen.getByLabelText(text.theme), {
      target: { value: text.title },
    });
    fireEvent.click(screen.getByRole("button", { name: text.generate }));

    await screen.findByText(plan.exhibition.introduction);
    expect(requestCuratorPlan).toHaveBeenCalledWith("token-1", expect.objectContaining({
      theme: text.title,
      intent: "warm-memory",
    }));
    expect(importScene).not.toHaveBeenCalled();
  });

  it("generates a preview and applies only after inline confirmation", async () => {
    let resolvePlan: (value: CuratorPlanResponse) => void = () => {};
    const requestCuratorPlan = vi.fn().mockImplementation(() => (
      new Promise<CuratorPlanResponse>((resolve) => {
        resolvePlan = resolve;
      })
    ));
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

    expect(screen.getByLabelText(text.intent)).toHaveValue("warm-memory");
    expect(screen.getByLabelText(text.preserveExisting)).toBeChecked();
    expect(screen.getByText("目前依你輸入的主題與偏好產生策展文字草稿；不會讀取或分析現有展品的內容。")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: text.warmMemory })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(text.intent), {
      target: { value: "professional-gallery" },
    });

    fireEvent.change(screen.getByLabelText(text.theme), {
      target: { value: text.title },
    });
    fireEvent.click(screen.getByRole("button", { name: text.generate }));
    expect(await screen.findByRole("button", { name: text.generating })).toBeDisabled();
    act(() => {
      resolvePlan(plan);
    });

    await screen.findByText(plan.exhibition.introduction);
    expect(requestCuratorPlan).toHaveBeenCalledWith("token-1", expect.objectContaining({
      theme: text.title,
      intent: "professional-gallery",
    }));
    expect(screen.getByText(`${text.intent}\uff1a${text.professionalGallery}`)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(text.intent), {
      target: { value: "warm-memory" },
    });
    expect(screen.getByText(`${text.intent}\uff1a${text.professionalGallery}`)).toBeInTheDocument();
    expect(importScene).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: text.applyToScene }));
    expect(importScene).not.toHaveBeenCalled();
    expect(screen.getByText(text.preserveWarning)).toBeInTheDocument();
    expect(screen.getByText(text.preserveDetail)).toBeInTheDocument();
    expect(screen.getByText(text.changeDetail)).toBeInTheDocument();
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

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(text.unchangedError);
      expect(screen.getByRole("alert")).toHaveTextContent("network failed");
    });
    expect(importScene).not.toHaveBeenCalled();
  });

  it("requires an explicit replacement choice and confirmation before removing existing artwork", async () => {
    const importScene = vi.fn();
    render(
      <AiCuratorPanel
        token="token-1"
        currentScene={currentScene}
        importScene={importScene}
        requestCuratorPlan={vi.fn().mockResolvedValue(plan)}
      />,
    );

    fireEvent.change(screen.getByLabelText(text.theme), { target: { value: text.title } });
    fireEvent.click(screen.getByRole("button", { name: text.generate }));
    await screen.findByText(plan.exhibition.introduction);
    fireEvent.click(screen.getByLabelText("重建展廳"));
    fireEvent.click(screen.getByRole("button", { name: text.applyToScene }));

    expect(screen.getByText(/現有展品將從場景移除/)).toBeInTheDocument();
    expect(importScene).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: text.confirmApply }));
    expect(importScene).toHaveBeenCalledTimes(1);
    expect(importScene.mock.calls[0][0].items.some((item: { id: string }) => item.id === "existing-painting")).toBe(false);
  });
});
