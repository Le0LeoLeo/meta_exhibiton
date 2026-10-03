import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  requestBuilderReview,
  requestBuilderRevision,
  requestBuilderSession,
  requestBuilderSessionById,
  requestBuilderVersionRestore,
} from "../../../../api/exhibitionScene";
import { useStore } from "../../store/useStore";
import { captureBuilderPreviewScene } from "../../aiBuilder/builderPreviewStore";
import { EditUI } from "./EditUI";
import { useMultiplayerStore } from "../../network/multiplayerStore";
import { emitChatMessage } from "../../network/socketClient";
import { I18nProvider } from "../../../../components/I18nProvider";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);

vi.mock("../../../../api/exhibitionScene", () => ({
  requestBuilderSession: vi.fn(),
  requestBuilderSessionById: vi.fn(),
  requestBuilderReview: vi.fn(),
  requestBuilderRevision: vi.fn(),
  requestBuilderVersionRestore: vi.fn(),
}));

vi.mock("../../../../api/client", async () => {
  const actual = await vi.importActual<typeof import("../../../../api/client")>("../../../../api/client");
  return {
    ...actual,
    loadAuth: () => ({ token: "jwt-token", user: { id: "user-1" } }),
    requestQwenTts: vi.fn(),
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

vi.mock("../../aiBuilder/builderPreviewStore", () => ({
  captureBuilderPreviewScene: vi.fn(async (_scene, capture) => capture()),
}));

function renderEditUI(items: any[] = []) {
  useStore.setState({
    mode: "edit",
    items,
    floorPlanElements: [],
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
    <I18nProvider>
      <MemoryRouter>
        <EditUI />
      </MemoryRouter>
    </I18nProvider>,
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
    localStorage.clear();
    localStorage.setItem("metaexpo-locale", "zh-TW");
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
    vi.mocked(requestBuilderSessionById).mockResolvedValue({
      sessionId: "builder-1",
      versionId: "version-1",
      status: "generated",
      exhibition: {
        title: "城市記憶展",
        curatorialStatement: "從街巷紋理走向未來想像。",
        sections: [],
      },
      scene: generatedScene,
      warnings: [],
      source: "qwen",
      revisionCount: 0,
      input: { prompt: "恢復展覽" },
      versions: [],
      createdAt: "2026-07-30T00:00:00.000Z",
      updatedAt: "2026-07-30T00:00:00.000Z",
    });
    vi.mocked(requestBuilderVersionRestore).mockResolvedValue({
      sessionId: "builder-1",
      versionId: "version-restored",
      status: "revised",
      exhibition: {
        title: "回復後展覽",
        curatorialStatement: "回復歷史版本後建立的新版本。",
        sections: [],
      },
      scene: generatedScene,
      warnings: [],
      source: "qwen",
      revisionCount: 1,
      restoredFromVersionId: "version-1",
      input: { prompt: "測試展覽" },
      versions: [],
      createdAt: "2026-07-30T00:00:00.000Z",
      updatedAt: "2026-07-30T00:01:00.000Z",
    });
    vi.mocked(requestBuilderRevision).mockResolvedValue({
      sessionId: "builder-1",
      versionId: "version-2",
      status: "revised",
      exhibition: {
        title: "改善後展覽",
        curatorialStatement: "改善後的策展敘事。",
        sections: [],
      },
      scene: generatedScene,
      warnings: [],
      source: "qwen",
      revisionCount: 1,
    });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('keeps conversation history across new chats and protects IME input from submission', async () => {
    renderEditUI();
    fireEvent.click(screen.getByRole('button', { name: '更多' }));
    fireEvent.click(screen.getByRole('button', { name: 'AI 建展' }));
    const panel = screen.getByRole('complementary', { name: 'AI 建展助手' });
    expect(panel).toBeInTheDocument();
    const input = document.querySelector('textarea')!;
    fireEvent.change(input, { target: { value: '建立我的展覽' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true, keyCode: 229 });
    expect(requestBuilderSession).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '生成展覽' }));
    await screen.findByText('預覽生成結果');
    fireEvent.click(screen.getByRole('button', { name: '新對話' }));
    expect(input).toHaveValue('');
    expect(screen.queryByText('預覽生成結果')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '過往對話' }));
    fireEvent.click(screen.getByRole('button', { name: '建立我的展覽' }));
    expect(screen.getByRole('log', { name: '過往對話' })).toHaveTextContent('建立我的展覽');
    expect(screen.getByRole('log', { name: '過往對話' })).toHaveTextContent('從街巷紋理走向未來想像。');
    expect(screen.getByRole('button', { name: '檢視版本' })).toBeInTheDocument();
  });

  it("removes quick upload while retaining editor navigation and artwork uploads", () => {
    const { container } = renderEditUI([
      { id: "painting-1", type: "painting", position: [0, 2, -4], rotation: [0, 0, 0], scale: [1, 1, 1] },
    ]);

    expect(screen.queryByRole("button", { name: /快速上傳|editorQuickUpload/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "觀展模式" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "平面圖" })).toBeInTheDocument();

    act(() => useStore.getState().setSelectedItemId("painting-1"));
    expect(container.querySelector('input[type="file"][accept*="application/pdf"]')).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "觀展模式" }));
    expect(useStore.getState().mode).toBe("view");
    act(() => useStore.getState().setMode("edit"));
    fireEvent.click(screen.getByRole("button", { name: "平面圖" }));
    expect(useStore.getState().mode).toBe("floor-plan");
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

  it("restores the last persisted builder session for the signed-in user", async () => {
    localStorage.setItem("ai-builder-session:user-1", "builder-1");

    renderEditUI();
    fireEvent.click(screen.getByRole("button", { name: /更多/ }));
    fireEvent.click(screen.getByRole("button", { name: "AI 建展" }));

    await waitFor(() => expect(requestBuilderSessionById).toHaveBeenCalledWith("jwt-token", "builder-1"));
    expect(await screen.findByText("城市記憶展")).toBeInTheDocument();
  });

  it("does not remember a late generation after leaving the editor", async () => {
    const generated = await requestBuilderSession("fixture", { prompt: "fixture" });
    let finish!: (value: typeof generated) => void;
    vi.mocked(requestBuilderSession).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const { unmount } = renderEditUI();
    fireEvent.click(screen.getByRole("button", { name: /更多/ }));
    fireEvent.click(screen.getByRole("button", { name: "AI 建展" }));
    fireEvent.change(screen.getByLabelText("展覽需求"), { target: { value: "New exhibition" } });
    fireEvent.click(screen.getByRole("button", { name: "生成展覽" }));
    unmount();
    await act(async () => { finish(generated); });
    expect(localStorage.getItem("ai-builder-session:user-1")).toBeNull();
  });

  it("keeps a new generation when an older remembered-session response arrives later", async () => {
    const restored = await requestBuilderSessionById("fixture", "fixture");
    let finish!: (value: typeof restored) => void;
    vi.mocked(requestBuilderSessionById).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    localStorage.setItem("ai-builder-session:user-1", "older-session");
    renderEditUI();
    fireEvent.click(screen.getByRole("button", { name: /更多/ }));
    fireEvent.click(screen.getByRole("button", { name: "AI 建展" }));
    fireEvent.change(screen.getByLabelText("展覽需求"), { target: { value: "New exhibition" } });
    fireEvent.click(screen.getByRole("button", { name: "生成展覽" }));
    expect(await screen.findByText("城市記憶展")).toBeInTheDocument();
    await act(async () => { finish({ ...restored, exhibition: { ...restored.exhibition, title: "Old exhibition" } }); });
    expect(screen.queryByText("Old exhibition")).not.toBeInTheDocument();
    expect(screen.getByLabelText("展覽需求")).toHaveValue("New exhibition");
  });

  it("still previews and applies when remembered-session storage is unavailable", async () => {
    const storage = Storage.prototype;
    const getItem = storage.getItem, setItem = storage.setItem, removeItem = storage.removeItem;
    const get = vi.spyOn(storage, "getItem").mockImplementation(function (this: Storage, key: string) {
      if (key.startsWith("ai-builder-session:")) throw new DOMException("Unavailable", "SecurityError");
      return getItem.call(this, key);
    });
    const set = vi.spyOn(storage, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
      if (key.startsWith("ai-builder-session:")) throw new DOMException("Full", "QuotaExceededError");
      setItem.call(this, key, value);
    });
    const remove = vi.spyOn(storage, "removeItem").mockImplementation(function (this: Storage, key: string) {
      if (key.startsWith("ai-builder-session:")) throw new DOMException("Unavailable", "SecurityError");
      removeItem.call(this, key);
    });
    try {
      renderEditUI();
      fireEvent.click(screen.getByRole("button", { name: /更多/ }));
      fireEvent.click(screen.getByRole("button", { name: "AI 建展" }));
      fireEvent.change(screen.getByLabelText("展覽需求"), { target: { value: "New exhibition" } });
      fireEvent.click(screen.getByRole("button", { name: "生成展覽" }));
      expect(await screen.findByText("城市記憶展")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "套用生成展覽" }));
      expect(useStore.getState().roomSize).toMatchObject(generatedScene.roomSize);
      expect(screen.queryByText("預覽生成結果")).not.toBeInTheDocument();
    } finally { get.mockRestore(); set.mockRestore(); remove.mockRestore(); }
  });

  it("continues autonomous improvement from a restored builder session", async () => {
    localStorage.setItem("ai-builder-session:user-1", "builder-1");

    renderEditUI();
    fireEvent.click(screen.getByRole("button", { name: /更多/ }));
    fireEvent.click(screen.getByRole("button", { name: "AI 建展" }));

    expect(await screen.findByText("城市記憶展")).toBeInTheDocument();
    const resumeButton = screen.getByRole("button", { name: "Agent 繼續改善" });
    expect(resumeButton).toBeEnabled();
    fireEvent.click(resumeButton);

    expect(await screen.findByRole("button", { name: "取消 Agent" })).toBeInTheDocument();
    await waitFor(() => expect(captureBuilderPreviewScene).toHaveBeenCalled());
    await waitFor(() => expect(requestBuilderReview).toHaveBeenCalled());
    expect(requestBuilderSession).not.toHaveBeenCalled();
    expect(await screen.findByText("本次 Agent 執行紀錄")).toBeInTheDocument();
    expect(screen.getAllByText("正在準備場景檢查")[0]).toBeInTheDocument();
    expect(screen.getAllByText("正在檢查參觀體驗")[0]).toBeInTheDocument();
    expect(screen.getAllByText("技術 90 · 策展 86")).toHaveLength(2);
    expect(screen.getByText("Agent 改善摘要")).toBeInTheDocument();
    expect(screen.getByText("檢查 1 輪 · 修改 0 次")).toBeInTheDocument();
    expect(screen.getByText("技術 90 → 90（+0）")).toBeInTheDocument();
    expect(screen.getByText("策展 86 → 86（+0）")).toBeInTheDocument();
  });

  it("automatically restores the better persisted version after a harmful revision", async () => {
    localStorage.setItem("ai-builder-session:user-1", "builder-1");
    const review = {
      technicalScore: 70, curatorialScore: 80, overallStatus: "needs_revision" as const,
      blockingIssues: [], viewReviews: [], revisionPrompt: "Improve spacing.",
    };
    vi.mocked(requestBuilderReview)
      .mockResolvedValueOnce({ sessionId: "builder-1", versionId: "version-1", status: "reviewed", source: "qwen", review })
      .mockResolvedValueOnce({ sessionId: "builder-1", versionId: "version-2", status: "reviewed", source: "qwen",
        review: { ...review, technicalScore: 60 } });
    renderEditUI();
    fireEvent.click(screen.getByRole("button", { name: /更多/ }));
    fireEvent.click(screen.getByRole("button", { name: "AI 建展" }));
    await screen.findByText("城市記憶展");
    fireEvent.click(screen.getByRole("button", { name: "Agent 繼續改善" }));
    await waitFor(() => expect(requestBuilderVersionRestore).toHaveBeenCalledWith("jwt-token", {
      sessionId: "builder-1", expectedVersionId: "version-2", targetVersionId: "version-1",
    }));
    expect(await screen.findByText("回復後展覽")).toBeInTheDocument();
    expect(screen.getByText("最新修改導致品質下降，Agent 已停止")).toBeInTheDocument();
    expect(requestBuilderRevision).toHaveBeenCalledTimes(1);
  });

  it("compares and restores a historical builder version as a new version", async () => {
    const historicalVersion = {
      sessionId: "builder-1",
      versionId: "version-1",
      status: "generated" as const,
      exhibition: {
        title: "早期版本",
        curatorialStatement: "第一版策展敘事。",
        sections: [],
      },
      scene: {
        ...generatedScene,
        roomSize: { ...generatedScene.roomSize, width: 18 },
      },
      warnings: [],
      source: "qwen" as const,
      revisionCount: 0,
    };
    const currentVersion = {
      ...historicalVersion,
      versionId: "version-2",
      status: "revised" as const,
      exhibition: {
        title: "目前版本",
        curatorialStatement: "第二版策展敘事。",
        sections: [],
      },
      scene: generatedScene,
      revisionCount: 1,
    };
    const restoredVersion = {
      ...historicalVersion,
      versionId: "version-restored",
      status: "revised" as const,
      revisionCount: 2,
      restoredFromVersionId: "version-1",
    };

    localStorage.setItem("ai-builder-session:user-1", "builder-1");
    vi.mocked(requestBuilderSessionById).mockResolvedValue({
      ...currentVersion,
      input: { prompt: "測試展覽" },
      versions: [historicalVersion, currentVersion],
      createdAt: "2026-07-30T00:00:00.000Z",
      updatedAt: "2026-07-30T00:01:00.000Z",
    });
    vi.mocked(requestBuilderVersionRestore).mockResolvedValue({
      ...restoredVersion,
      input: { prompt: "測試展覽" },
      versions: [historicalVersion, currentVersion, restoredVersion],
      createdAt: "2026-07-30T00:00:00.000Z",
      updatedAt: "2026-07-30T00:02:00.000Z",
    });

    renderEditUI();
    fireEvent.click(screen.getByRole("button", { name: /更多/ }));
    fireEvent.click(screen.getByRole("button", { name: "AI 建展" }));

    expect(await screen.findByText("版本歷史")).toBeInTheDocument();
    fireEvent.click(screen.getByText("變更與版本"));
    fireEvent.click(screen.getByRole("button", { name: /版本 1/ }));
    expect(screen.getByText("與目前版本比較")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "回復此版本" }));

    await waitFor(() => {
      expect(requestBuilderVersionRestore).toHaveBeenCalledWith("jwt-token", {
        sessionId: "builder-1",
        expectedVersionId: "version-2",
        targetVersionId: "version-1",
      });
    });
    expect(await screen.findByText("由歷史版本回復")).toBeInTheDocument();
  });

  it("cancels an autonomous builder run without reporting a failure", async () => {
    let requestSignal: AbortSignal | undefined;
    vi.mocked(requestBuilderSession).mockImplementation((_token, _payload, signal) => (
      new Promise((_resolve, reject) => {
        requestSignal = signal;
        signal?.addEventListener("abort", () => {
          reject(new DOMException("cancelled", "AbortError"));
        }, { once: true });
      })
    ));

    renderEditUI();
    fireEvent.click(screen.getByRole("button", { name: /更多/ }));
    fireEvent.click(screen.getByRole("button", { name: "AI 建展" }));
    fireEvent.change(document.querySelector("textarea") as HTMLTextAreaElement, {
      target: { value: "建立可取消的展覽" },
    });
    fireEvent.click(screen.getByRole("button", { name: "傳送訊息" }));

    fireEvent.click(await screen.findByRole("button", { name: "取消 Agent" }));

    await waitFor(() => expect(requestSignal?.aborted).toBe(true));
    expect((await screen.findAllByText("已取消自動建展"))[0]).toBeInTheDocument();
    expect(screen.queryByText("AI agent failed")).not.toBeInTheDocument();
  });

  it("supports a review-only agent run with zero automatic revisions", async () => {
    vi.mocked(requestBuilderReview).mockResolvedValueOnce({
      sessionId: "builder-1",
      versionId: "version-1",
      status: "reviewed",
      source: "qwen",
      review: {
        technicalScore: 62,
        curatorialScore: 70,
        overallStatus: "needs_revision",
        blockingIssues: [],
        viewReviews: [],
        revisionPrompt: "Improve spacing.",
      },
    });

    renderEditUI();
    fireEvent.click(screen.getByRole("button", { name: /更多/ }));
    fireEvent.click(screen.getByRole("button", { name: "AI 建展" }));
    fireEvent.change(document.querySelector("textarea") as HTMLTextAreaElement, {
      target: { value: "只檢查展覽，不自動修改" },
    });
    fireEvent.change(screen.getByLabelText(/自動改善上限/), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "傳送訊息" }));

    await waitFor(() => expect(requestBuilderReview).toHaveBeenCalled());
    expect(requestBuilderRevision).not.toHaveBeenCalled();
    expect(await screen.findByText("已達自動改善次數上限")).toBeInTheDocument();
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
    expect(screen.getAllByText("從街巷紋理走向未來想像。")[0]).toBeInTheDocument();
    expect(screen.getByText("來源")).toBeInTheDocument();
    expect(screen.getByText("AI 生成")).toBeInTheDocument();
    expect(screen.getByText("提醒")).toBeInTheDocument();
    expect(screen.getByText("已使用示範展品補足空間。")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "套用生成展覽" }));

    await waitFor(() => expect(importScene).toHaveBeenCalledWith(generatedScene));
  }, 15_000);

  it("preserves newer scene edits when applying an older preview", async () => {
    renderEditUI();
    const importScene = vi.spyOn(useStore.getState(), "importScene");
    fireEvent.click(screen.getByRole("button", { name: /更多/ }));
    fireEvent.click(screen.getByRole("button", { name: "AI 建展" }));
    fireEvent.change(document.querySelector("textarea")!, { target: { value: "Arrange three sections" } });
    fireEvent.click(screen.getByRole("button", { name: "生成展覽" }));
    await screen.findByText("預覽生成結果");
    act(() => useStore.setState({ roomSize: { ...useStore.getState().roomSize, width: 28 } }));
    fireEvent.click(screen.getByRole("button", { name: "套用生成展覽" }));
    expect(importScene).not.toHaveBeenCalled();
    expect(useStore.getState().roomSize.width).toBe(28);
    expect(await screen.findByText(/展覽已在生成期間變更/)).toBeInTheDocument();
  });

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

  it("captures a VL review through the isolated preview scene without importing it", async () => {
    const importScene = vi.spyOn(useStore.getState(), "importScene");
    renderEditUI();

    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    fireEvent.click(screen.getByRole("button", { name: "AI 建展" }));
    const promptInput = document.querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.change(promptInput, {
      target: { value: "Build a Macau memory exhibition" },
    });
    fireEvent.click(screen.getByRole("button", { name: "生成展覽" }));

    fireEvent.click(await screen.findByRole("button", { name: "檢查場景" }));

    await waitFor(() => expect(requestBuilderReview).toHaveBeenCalled());
    expect(captureBuilderPreviewScene).toHaveBeenCalledWith(generatedScene, expect.any(Function));
    expect(importScene).not.toHaveBeenCalled();
    expect(await screen.findByText("技術 90 · 策展 86")).toBeInTheDocument();
  }, 15_000);

  it("sends reusable artwork assets with the complete current scene", async () => {
    const artwork = {
      id: "painting-user-1",
      type: "painting",
      position: [0, 2, -4],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      content: "data:image/png;base64,local-preview",
      assetId: "asset-user-1",
      assetUrl: "/api/media/assets/asset-user-1",
      title: "Macau Memory",
      artist: "Student A",
      description: "A user-owned artwork",
      fileMimeType: "image/png",
    };
    renderEditUI([artwork]);

    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    fireEvent.click(screen.getByRole("button", { name: "AI 建展" }));
    fireEvent.change(document.querySelector("textarea") as HTMLTextAreaElement, {
      target: { value: "改善展品動線" },
    });
    fireEvent.click(screen.getByRole("button", { name: "生成展覽" }));

    await waitFor(() => expect(requestBuilderSession).toHaveBeenCalledWith(
      "jwt-token",
      expect.objectContaining({
        currentScene: expect.objectContaining({ items: [expect.objectContaining({ id: "painting-user-1" })] }),
        assets: [{
          title: "Macau Memory",
          artist: "Student A",
          description: "A user-owned artwork",
          imageUrl: "/api/media/assets/asset-user-1",
          type: "image",
        }],
      }),
    ));
  }, 15_000);

  it("blocks apply when the preview does not preserve an existing artwork", async () => {
    const importScene = vi.spyOn(useStore.getState(), "importScene");
    renderEditUI([{
      id: "painting-user-1",
      type: "painting",
      position: [0, 2, -4],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      content: "/api/media/assets/asset-user-1",
      assetId: "asset-user-1",
      assetUrl: "/api/media/assets/asset-user-1",
    }]);

    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    fireEvent.click(screen.getByRole("button", { name: "AI 建展" }));
    fireEvent.change(document.querySelector("textarea") as HTMLTextAreaElement, {
      target: { value: "重新安排展覽" },
    });
    fireEvent.click(screen.getByRole("button", { name: "生成展覽" }));

    const applyButton = await screen.findByRole("button", { name: "套用生成展覽" });
    expect(screen.getByText("部分原有展品或素材未保留，建議放棄此結果")).toBeInTheDocument();
    expect(applyButton).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /允許按要求刪除或更換原有作品/ }));
    expect(applyButton).toBeDisabled(); // Permission belongs to the originating request, not a later toggle.
    fireEvent.click(applyButton);
    expect(importScene).not.toHaveBeenCalled();
  }, 15_000);

  it("allows an explicitly authorized removal and records that permission in the request", async () => {
    const importScene = vi.spyOn(useStore.getState(), "importScene");
    renderEditUI([{ id: 'user-art', type: 'painting', content: '/art.png', position: [0, 2, -4], rotation: [0, 0, 0], scale: [1, 1, 1] }]);
    fireEvent.click(screen.getByRole('button', { name: '更多' }));
    fireEvent.click(screen.getByRole('button', { name: 'AI 建展' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /允許按要求刪除或更換原有作品/ }));
    fireEvent.change(document.querySelector('textarea')!, { target: { value: '刪除這幅作品' } });
    fireEvent.click(screen.getByRole('button', { name: '生成展覽' }));
    const button = await screen.findByRole('button', { name: '套用生成展覽' });
    await waitFor(() => expect(button).toBeEnabled());
    expect(requestBuilderSession).toHaveBeenCalledWith('jwt-token', expect.objectContaining({ editMode: 'complete', allowDestructive: true }));
    fireEvent.click(button);
    await waitFor(() => expect(importScene).toHaveBeenCalled());
  }, 15_000);

  it("reloads the latest persisted session after a stale revision conflict", async () => {
    vi.mocked(requestBuilderRevision).mockRejectedValueOnce(Object.assign(
      new Error("builder session version is stale"),
      { status: 409 },
    ));
    vi.mocked(requestBuilderSessionById).mockResolvedValueOnce({
      sessionId: "builder-1",
      versionId: "version-2",
      status: "revised",
      exhibition: {
        title: "其他分頁的最新版本",
        curatorialStatement: "從伺服器同步的最新策展內容。",
        sections: [],
      },
      scene: generatedScene,
      warnings: [],
      source: "qwen",
      revisionCount: 1,
      input: { prompt: "建立城市記憶展覽" },
      versions: [{
        sessionId: "builder-1",
        versionId: "version-2",
        status: "revised",
        exhibition: {
          title: "其他分頁的最新版本",
          curatorialStatement: "從伺服器同步的最新策展內容。",
          sections: [],
        },
        scene: generatedScene,
        warnings: [],
        source: "qwen",
        revisionCount: 1,
      }],
      createdAt: "2026-07-30T00:00:00.000Z",
      updatedAt: "2026-07-30T00:03:00.000Z",
    });

    renderEditUI();
    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    fireEvent.click(screen.getByRole("button", { name: "AI 建展" }));
    fireEvent.change(document.querySelector("textarea") as HTMLTextAreaElement, {
      target: { value: "建立城市記憶展覽" },
    });
    fireEvent.click(screen.getByRole("button", { name: "生成展覽" }));
    fireEvent.click(await screen.findByRole("button", { name: "檢查場景" }));
    fireEvent.click(await screen.findByRole("button", { name: "依檢查改善" }));

    await waitFor(() => {
      expect(requestBuilderSessionById).toHaveBeenCalledWith("jwt-token", "builder-1");
    });
    expect(await screen.findByText("其他分頁的最新版本")).toBeInTheDocument();
    expect(screen.queryByText("builder session version is stale")).not.toBeInTheDocument();
  }, 15_000);

  it("switches auxiliary panels without stacking them over the editor", () => {
    renderEditUI();
    fireEvent.click(screen.getByRole("button", { name: "更多", exact: true }));
    expect(document.getElementById("editor-more-panel")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "連線", exact: true }));
    expect(document.getElementById("editor-more-panel")).not.toBeInTheDocument();
    expect(document.getElementById("editor-network-panel")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "模型庫", exact: true }));
    expect(document.getElementById("editor-network-panel")).not.toBeInTheDocument();
    expect(document.getElementById("editor-model-library")).toBeInTheDocument();
  });

  it("dismisses an auxiliary panel with Escape and returns keyboard focus without clearing selection", () => {
    renderEditUI([{ id: "selected-text", type: "text", content: "Test", position: [0, 1, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }]);
    act(() => useStore.setState({ selectedItemId: "selected-text", selectedItemIds: ["selected-text"] }));
    const more = screen.getByRole("button", { name: "更多", exact: true });
    fireEvent.click(more);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.getElementById("editor-more-panel")).not.toBeInTheDocument();
    expect(more).toHaveFocus();
    expect(useStore.getState().selectedItemId).toBe("selected-text");
  });

  it("blocks applying a rejected zero-operation fallback and explains that generation did not complete", async () => {
    renderEditUI();
    const baseline = useStore.getState().exportScene();
    vi.mocked(requestBuilderSession).mockResolvedValueOnce({
      sessionId: "builder-rejected", versionId: "version-1", status: "generated", revisionCount: 0,
      source: "fallback", appliedOperationCount: 0, warnings: ["DISPLAY_OCCUPIED"], scene: baseline,
      exhibition: { title: "Requested plan", curatorialStatement: "", sections: [] },
    });
    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    fireEvent.click(screen.getByRole("button", { name: "AI 建展" }));
    fireEvent.change(document.querySelector("textarea") as HTMLTextAreaElement, { target: { value: "分成三區" } });
    fireEvent.click(screen.getByRole("button", { name: "生成展覽" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("未完成建展");
    // A run that changed nothing offers only Discard, never "preview ready" or a saved draft.
    expect(screen.getByText("生成已停止，展覽沒有任何改動。")).toBeInTheDocument();
    expect(screen.queryByText("展覽預覽已準備好")).not.toBeInTheDocument();
    expect(screen.queryByText("草稿版本已記錄")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "套用生成展覽" })).not.toBeInTheDocument();
    expect(useStore.getState().exportScene()).toEqual(baseline);
  });

  it("keeps the preview available when the scene check is unavailable", async () => {
    vi.mocked(requestBuilderReview).mockResolvedValueOnce({
      sessionId: "builder-1",
      versionId: "version-1",
      status: "unavailable",
      source: "fallback",
      review: null,
      errorCode: "VISION_PROVIDER_FAILED",
      message: "場景檢查服務暫時無法連線。",
    });
    renderEditUI();

    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    fireEvent.click(screen.getByRole("button", { name: "AI 建展" }));
    fireEvent.change(document.querySelector("textarea") as HTMLTextAreaElement, {
      target: { value: "建立城市記憶展覽" },
    });
    fireEvent.click(screen.getByRole("button", { name: "生成展覽" }));
    fireEvent.click(await screen.findByRole("button", { name: "檢查場景" }));

    expect(await screen.findByText("場景檢查不可用")).toBeInTheDocument();
    expect(await screen.findByText("場景檢查暫時不可用")).toBeInTheDocument();
    expect(screen.getByText("你仍可檢視預覽，但建議自行確認動線與展示效果。")).toBeInTheDocument();
    expect(screen.queryByText("場景檢查服務暫時無法連線。")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "套用生成展覽" })).toBeEnabled();
  }, 15_000);
});

describe("multiplayer panel input", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("metaexpo-locale", "zh-TW");
  });
  afterEach(() => { cleanup(); localStorage.clear(); useMultiplayerStore.getState().clearSession(); vi.clearAllMocks(); });
  function openPanel() {
    useMultiplayerStore.setState({ enabled: true, connected: true, role: "owner" });
    renderEditUI();
    fireEvent.click(screen.getByRole("button", { name: "連線", exact: true }));
  }
  it("only applies a room name after finishing input", () => {
    openPanel();
    const previous = useMultiplayerStore.getState().roomId;
    const input = screen.getByLabelText("房間 ID");
    fireEvent.change(input, { target: { value: "new-gallery" } });
    expect(useMultiplayerStore.getState().roomId).toBe(previous);
    fireEvent.blur(input);
    expect(useMultiplayerStore.getState().roomId).toBe("new-gallery");
  });
  it("does not send IME composition or discard rejected messages", () => {
    openPanel();
    const input = screen.getByRole("textbox", { name: "房間聊天室" });
    fireEvent.change(input, { target: { value: "你好" } });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true, keyCode: 229 });
    expect(emitChatMessage).not.toHaveBeenCalled();
    vi.mocked(emitChatMessage).mockReturnValue(false);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input).toHaveValue("你好");
    vi.mocked(emitChatMessage).mockReturnValue(true);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input).toHaveValue("");
  });
});
