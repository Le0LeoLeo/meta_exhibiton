import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SceneSnapshot } from "../modules/metaverse3d/store/metaverseStoreTypes";
import {
  requestBuilderSessionById,
  requestBuilderVersionRestore,
  requestBuilderRevision,
  requestBuilderReview,
  requestBuilderSession,
  requestExhibitionScene,
} from "./exhibitionScene";

describe("exhibition scene API", () => {
  it("allows a bounded model correction to finish after the old one-minute deadline", async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal('fetch', vi.fn((_url, init) => new Promise<Response>((resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        setTimeout(() => resolve(Response.json({source: 'qwen'})), 90000);
      })));
      const result = requestBuilderSession('test', {prompt: 'Six zones'});
      await vi.advanceTimersByTimeAsync(90000);
      await expect(result).resolves.toMatchObject({source: 'qwen'});
    } finally { vi.useRealTimers(); }
  });
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
        exhibition: { title: "AI 展覽", curatorialStatement: "", sections: [] },
        scene: { roomSize: {}, items: [], floorPlanElements: [], wallMaterialOverrides: {} },
        warnings: [],
        source: "fallback",
    })));
  });

  it("posts the AI builder request with auth headers", async () => {
    await requestExhibitionScene("jwt-token", {
      prompt: "澳門城市記憶",
      exhibitCount: 6,
      style: "white-box",
    });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(url).toEqual(expect.stringContaining("/api/ai/exhibition-scene"));
    expect(headers.get("Authorization")).toBe("Bearer jwt-token");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(fetch).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          prompt: "澳門城市記憶",
          exhibitCount: 6,
          style: "white-box",
        }),
      }),
    );
  });

  it("starts a builder agent session", async () => {
    await requestBuilderSession("jwt-token", {
      prompt: "Macau memory",
      exhibitCount: 6,
      style: "warm-museum",
    });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toEqual(expect.stringContaining("/api/ai/exhibition-builder/start"));
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer jwt-token");
    expect(fetch).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          prompt: "Macau memory",
          exhibitCount: 6,
          style: "warm-museum",
        }),
      }),
    );
  });

  it("forwards caller cancellation to a builder agent request", async () => {
    const controller = new AbortController();
    controller.abort("cancel builder run");

    await expect(requestBuilderSession("jwt-token", { prompt: "Macau memory" }, controller.signal)).rejects.toMatchObject({ code: 'REQUEST_ABORTED' });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(init?.signal?.aborted).toBe(true);
  });

  it("restores a persisted builder agent session by id", async () => {
    await requestBuilderSessionById("jwt-token", "builder 1");

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toEqual(expect.stringContaining("/api/ai/exhibition-builder/sessions/builder%201"));
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer jwt-token");
    expect(fetch).toHaveBeenCalledWith(
      url,
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("restores a historical builder version with an optimistic current-version guard", async () => {
    await requestBuilderVersionRestore("jwt-token", {
      sessionId: "builder 1",
      expectedVersionId: "version-3",
      targetVersionId: "version-1",
    });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toEqual(expect.stringContaining("/api/ai/exhibition-builder/sessions/builder%201/restore"));
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer jwt-token");
    expect(fetch).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          expectedVersionId: "version-3",
          targetVersionId: "version-1",
        }),
      }),
    );
  });

  it("preserves the HTTP status when a builder version is stale", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ message: "builder session version is stale" }, { status: 409 }));

    await expect(requestBuilderVersionRestore("jwt-token", {
      sessionId: "builder-1",
      expectedVersionId: "version-1",
      targetVersionId: "version-0",
    })).rejects.toMatchObject({
      name: "BuilderApiError",
      message: "builder session version is stale",
      status: 409,
    });
  });

  it("submits screenshots for builder agent review", async () => {
    const payload = {
      sessionId: "builder-1",
      versionId: "version-1",
      scene: { roomSize: {}, items: [], floorPlanElements: [], wallMaterialOverrides: {} } as SceneSnapshot,
      screenshots: [
        { viewId: "entrance", label: "Entrance", dataUrl: "data:image/png;base64,aaa" },
        { viewId: "left", label: "Left wall", dataUrl: "data:image/png;base64,bbb" },
        { viewId: "top", label: "Top", dataUrl: "data:image/png;base64,ccc" },
      ],
    };

    await requestBuilderReview("jwt-token", payload);

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toEqual(expect.stringContaining("/api/ai/exhibition-builder/review"));
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer jwt-token");
    expect(fetch).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );
  });

  it("requests a review-guided builder revision", async () => {
    const payload = {
      sessionId: "builder-1",
      versionId: "version-1",
      revisionCount: 1,
      prompt: "Original brief",
      scene: { roomSize: {}, items: [], floorPlanElements: [], wallMaterialOverrides: {} } as SceneSnapshot,
      review: {
        technicalScore: 60,
        curatorialScore: 70,
        overallStatus: "needs_revision" as const,
        blockingIssues: [],
        viewReviews: [],
        revisionPrompt: "Move paintings apart.",
      },
    };

    await requestBuilderRevision("jwt-token", payload);

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toEqual(expect.stringContaining("/api/ai/exhibition-builder/revise"));
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer jwt-token");
    expect(fetch).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );
  });
});
