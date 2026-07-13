import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  requestBuilderRevision,
  requestBuilderReview,
  requestBuilderSession,
  requestExhibitionScene,
} from "./exhibitionScene";

describe("exhibition scene API", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        exhibition: { title: "AI 展覽", curatorialStatement: "", sections: [] },
        scene: { roomSize: {}, items: [], floorPlanElements: [], wallMaterialOverrides: {} },
        warnings: [],
        source: "fallback",
      }),
    }));
  });

  it("posts the AI builder request with auth headers", async () => {
    await requestExhibitionScene("jwt-token", {
      prompt: "澳門城市記憶",
      exhibitCount: 6,
      style: "white-box",
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/ai/exhibition-scene"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer jwt-token",
          "Content-Type": "application/json",
        }),
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

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/ai/exhibition-builder/start"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer jwt-token" }),
        body: JSON.stringify({
          prompt: "Macau memory",
          exhibitCount: 6,
          style: "warm-museum",
        }),
      }),
    );
  });

  it("submits screenshots for builder agent review", async () => {
    const payload = {
      sessionId: "builder-1",
      versionId: "version-1",
      scene: { roomSize: {}, items: [], floorPlanElements: [], wallMaterialOverrides: {} } as any,
      screenshots: [
        { viewId: "entrance", label: "Entrance", dataUrl: "data:image/png;base64,aaa" },
        { viewId: "left", label: "Left wall", dataUrl: "data:image/png;base64,bbb" },
        { viewId: "top", label: "Top", dataUrl: "data:image/png;base64,ccc" },
      ],
    };

    await requestBuilderReview("jwt-token", payload);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/ai/exhibition-builder/review"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer jwt-token" }),
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
      scene: { roomSize: {}, items: [], floorPlanElements: [], wallMaterialOverrides: {} } as any,
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

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/ai/exhibition-builder/revise"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer jwt-token" }),
        body: JSON.stringify(payload),
      }),
    );
  });
});
