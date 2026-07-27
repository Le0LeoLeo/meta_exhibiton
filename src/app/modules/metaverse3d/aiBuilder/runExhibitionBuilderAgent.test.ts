import { describe, expect, it, vi } from "vitest";
import { didReviewImprove, runExhibitionBuilderAgent } from "./runExhibitionBuilderAgent";

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
    source: "qwen" as const,
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
  it("detects meaningful review improvement", () => {
    const previous = createReview("needs_revision").review;
    const next = { ...previous, technicalScore: previous.technicalScore + 3 };

    expect(didReviewImprove(previous, next)).toBe(true);
    expect(didReviewImprove(previous, { ...previous, technicalScore: previous.technicalScore + 2 })).toBe(false);
  });

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
    expect(result.stopReason).toBe("passed");
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

  it("stops without revising when visual review is unavailable", async () => {
    const requestBuilderRevision = vi.fn();
    const result = await runExhibitionBuilderAgent({
      token: "jwt-token",
      input: { prompt: "Macau memory" },
      exportScene: () => ({ roomSize: {}, items: [], floorPlanElements: [], wallMaterialOverrides: {} }) as any,
      importScene: vi.fn(),
      requestBuilderSession: vi.fn().mockResolvedValue(createSession()),
      requestBuilderReview: vi.fn().mockResolvedValue({
        sessionId: "builder-1",
        versionId: "version-1",
        status: "unavailable",
        source: "fallback",
        errorCode: "VISION_PROVIDER_FAILED",
        message: "Visual review unavailable",
        review: null,
      }),
      requestBuilderRevision,
      captureScreenshots: vi.fn().mockResolvedValue([]),
    });

    expect(result.stopReason).toBe("review_unavailable");
    expect(requestBuilderRevision).not.toHaveBeenCalled();
  });

  it("stops after a revision that does not improve the review", async () => {
    const unchangedReview = createReview("needs_revision");
    const requestBuilderRevision = vi.fn().mockResolvedValue(createSession("version-2"));
    const result = await runExhibitionBuilderAgent({
      token: "jwt-token",
      input: { prompt: "Macau memory" },
      exportScene: () => ({ roomSize: {}, items: [], floorPlanElements: [], wallMaterialOverrides: {} }) as any,
      importScene: vi.fn(),
      requestBuilderSession: vi.fn().mockResolvedValue(createSession()),
      requestBuilderReview: vi.fn()
        .mockResolvedValueOnce(unchangedReview)
        .mockResolvedValueOnce({ ...unchangedReview, versionId: "version-2" }),
      requestBuilderRevision,
      captureScreenshots: vi.fn().mockResolvedValue([]),
      maxRevisions: 3,
    });

    expect(result.stopReason).toBe("no_improvement");
    expect(requestBuilderRevision).toHaveBeenCalledTimes(1);
  });

  it("reports progress phases and stops at the revision limit", async () => {
    const first = createReview("needs_revision");
    const second = {
      ...first,
      versionId: "version-2",
      review: { ...first.review, technicalScore: first.review.technicalScore + 3 },
    };
    const phases: string[] = [];
    const result = await runExhibitionBuilderAgent({
      token: "jwt-token",
      input: { prompt: "Macau memory" },
      exportScene: () => ({ roomSize: {}, items: [], floorPlanElements: [], wallMaterialOverrides: {} }) as any,
      importScene: vi.fn(),
      requestBuilderSession: vi.fn().mockResolvedValue(createSession()),
      requestBuilderReview: vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second),
      requestBuilderRevision: vi.fn().mockResolvedValue(createSession("version-2")),
      captureScreenshots: vi.fn().mockResolvedValue([]),
      maxRevisions: 1,
      onStep: (step) => phases.push(step.phase),
    });

    expect(result.stopReason).toBe("revision_limit");
    expect(phases).toEqual([
      "generating",
      "capturing",
      "reviewing",
      "revising",
      "capturing",
      "reviewing",
      "stopped",
    ]);
  });

  it("clamps the requested revision limit to the server maximum", async () => {
    const steps: Array<{ phase: string; maxRevisions: number }> = [];
    const result = await runExhibitionBuilderAgent({
      token: "jwt-token",
      input: { prompt: "Macau memory" },
      maxRevisions: 99,
      exportScene: () => ({ roomSize: {}, items: [], floorPlanElements: [], wallMaterialOverrides: {} }) as any,
      importScene: vi.fn(),
      requestBuilderSession: vi.fn().mockResolvedValue(createSession()),
      requestBuilderReview: vi.fn().mockResolvedValue({
        sessionId: "builder-1",
        versionId: "version-1",
        status: "unavailable",
        source: "fallback",
        review: null,
      }),
      requestBuilderRevision: vi.fn(),
      captureScreenshots: vi.fn().mockResolvedValue([]),
      onStep: (step) => steps.push(step),
    });

    expect(result.stopReason).toBe("review_unavailable");
    expect(steps.every((step) => step.maxRevisions === 3)).toBe(true);
  });
});
