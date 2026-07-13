import { describe, expect, it, vi } from "vitest";
import { runExhibitionBuilderAgent } from "./runExhibitionBuilderAgent";

function createSession(versionId = "version-1") {
  return {
    sessionId: "builder-1",
    versionId,
    status: versionId === "version-1" ? "generated" as const : "revised" as const,
    exhibition: { title: "Macau Memory", curatorialStatement: "A journey.", sections: [] },
    scene: {
      roomSize: { width: 20, length: 16, height: 6, wallThickness: 0.1 },
      items: [],
      floorPlanElements: [],
      wallMaterialOverrides: {},
    } as any,
    warnings: [],
    source: "qwen" as const,
    revisionCount: versionId === "version-1" ? 0 : 1,
  };
}

function createReview(overallStatus: "pass" | "needs_revision") {
  return {
    sessionId: "builder-1",
    versionId: "version-1",
    status: "reviewed" as const,
    review: {
      technicalScore: overallStatus === "pass" ? 92 : 62,
      curatorialScore: 86,
      overallStatus,
      blockingIssues: [],
      viewReviews: [],
      revisionPrompt: "Improve spacing.",
    },
  };
}

describe("runExhibitionBuilderAgent", () => {
  it("generates and accepts a scene when the first review passes", async () => {
    const originalScene = { roomSize: {}, items: [], floorPlanElements: [], wallMaterialOverrides: {} } as any;
    const requestBuilderSession = vi.fn().mockResolvedValue(createSession());
    const requestBuilderReview = vi.fn().mockResolvedValue(createReview("pass"));
    const requestBuilderRevision = vi.fn();
    const captureScreenshots = vi.fn().mockResolvedValue([
      { viewId: "entrance", label: "Entrance", dataUrl: "data:image/png;base64,aaa" },
    ]);
    const importScene = vi.fn();

    const result = await runExhibitionBuilderAgent({
      token: "jwt-token",
      input: { prompt: "Macau memory", exhibitCount: 6 },
      exportScene: () => originalScene,
      importScene,
      requestBuilderSession,
      requestBuilderReview,
      requestBuilderRevision,
      captureScreenshots,
    });

    expect(result.review.review.overallStatus).toBe("pass");
    expect(requestBuilderRevision).not.toHaveBeenCalled();
    expect(importScene).toHaveBeenCalledWith(createSession().scene);
    expect(importScene).toHaveBeenLastCalledWith(originalScene);
  });

  it("revises and reviews again until the scene passes", async () => {
    const requestBuilderSession = vi.fn().mockResolvedValue(createSession());
    const requestBuilderReview = vi
      .fn()
      .mockResolvedValueOnce(createReview("needs_revision"))
      .mockResolvedValueOnce({ ...createReview("pass"), versionId: "version-2" });
    const requestBuilderRevision = vi.fn().mockResolvedValue(createSession("version-2"));

    const result = await runExhibitionBuilderAgent({
      token: "jwt-token",
      input: { prompt: "Macau memory", exhibitCount: 6 },
      exportScene: () => ({ roomSize: {}, items: [], floorPlanElements: [], wallMaterialOverrides: {} }) as any,
      importScene: vi.fn(),
      requestBuilderSession,
      requestBuilderReview,
      requestBuilderRevision,
      captureScreenshots: vi.fn().mockResolvedValue([
        { viewId: "entrance", label: "Entrance", dataUrl: "data:image/png;base64,aaa" },
      ]),
      maxRevisions: 2,
    });

    expect(result.session.versionId).toBe("version-2");
    expect(result.review.review.overallStatus).toBe("pass");
    expect(requestBuilderRevision).toHaveBeenCalledWith(
      "jwt-token",
      expect.objectContaining({
        sessionId: "builder-1",
        versionId: "version-1",
        prompt: "Macau memory",
        revisionCount: 0,
      }),
    );
    expect(requestBuilderReview).toHaveBeenCalledTimes(2);
  });
});
