import { describe, expect, it, vi } from "vitest";
import {
  classifyBuilderReviewChange,
  didReviewImprove,
  runExhibitionBuilderAgent,
} from "./runExhibitionBuilderAgent";

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
  it("reports zero-operation planning failure separately from a missing visual review", async () => {
    const captureScreenshots = vi.fn();
    const result = await runExhibitionBuilderAgent({token: 'test', input: {prompt: 'Six zones'},
      requestBuilderSession: vi.fn().mockResolvedValue({...createSession(), source: 'fallback', appliedOperationCount: 0}),
      requestBuilderRevision: vi.fn(), requestBuilderReview: vi.fn(), captureScreenshots});
    expect(result.stopReason).toBe('generation_failed');
    expect(captureScreenshots).not.toHaveBeenCalled();
  });
  it("repairs automatic issues before stopping for remaining manual content", async () => {
    const manual = {category: 'content' as const, severity: 'medium' as const, viewId: 'entrance', message: 'Missing supplied archive', suggestedFix: 'Upload archive', resolution: 'manual' as const};
    const automatic = {category: 'readability' as const, severity: 'medium' as const, viewId: 'entrance', message: 'Labels overlap', suggestedFix: 'Move labels', resolution: 'automatic' as const};
    const first = createReview('needs_revision');
    const next = createReview('needs_revision');
    const requestBuilderRevision = vi.fn().mockResolvedValue(createSession('version-2'));
    const result = await runExhibitionBuilderAgent({token: 'test', input: {prompt: 'Improve'},
      requestBuilderSession: vi.fn().mockResolvedValue(createSession()), requestBuilderRevision,
      requestBuilderReview: vi.fn().mockResolvedValueOnce({...first, review: {...first.review, blockingIssues: [manual, automatic]}})
        .mockResolvedValueOnce({...next, review: {...next.review, technicalScore: 90, blockingIssues: [manual]}}),
      captureScreenshots: vi.fn().mockResolvedValue([])});
    expect(requestBuilderRevision).toHaveBeenCalledTimes(1);
    expect(result.stopReason).toBe('manual_required');
    expect(result.bestSession?.versionId).toBe('version-2');
  });
  it("does not spend a vision call on a fallback generation", async () => {
    const captureScreenshots = vi.fn();
    const requestBuilderReview = vi.fn();
    const result = await runExhibitionBuilderAgent({
      token: "test", input: {prompt: "Improve"},
      requestBuilderSession: vi.fn().mockResolvedValue({...createSession(), source: "fallback"}),
      requestBuilderRevision: vi.fn(), requestBuilderReview, captureScreenshots,
    });
    expect(result.stopReason).toBe("review_unavailable");
    expect(result.review.review).toBeNull();
    expect(captureScreenshots).not.toHaveBeenCalled();
    expect(requestBuilderReview).not.toHaveBeenCalled();
  });
  it("stops without scoring on capture failure and retains the previous reviewed version", async () => {
    const requestBuilderReview = vi.fn().mockResolvedValue(createReview("needs_revision"));
    const result = await runExhibitionBuilderAgent({
      token: "test", input: { prompt: "Improve" },
      requestBuilderSession: vi.fn().mockResolvedValue(createSession()),
      requestBuilderRevision: vi.fn().mockResolvedValue(createSession("version-2")),
      requestBuilderReview,
      captureScreenshots: vi.fn().mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("Capture unavailable")),
    });
    expect(result.stopReason).toBe("review_unavailable");
    expect(result.review.review).toBeNull();
    expect(result.bestSession?.versionId).toBe("version-1");
    expect(requestBuilderReview).toHaveBeenCalledTimes(1);
  });
  it("detects meaningful review improvement", () => {
    const previous = createReview("needs_revision").review;
    const next = { ...previous, technicalScore: previous.technicalScore + 3 };

    expect(didReviewImprove(previous, next)).toBe(true);
    expect(didReviewImprove(previous, { ...previous, technicalScore: previous.technicalScore + 2 })).toBe(false);
  });

  it("classifies a new high-severity blocker as regression despite a score gain", () => {
    const previous = createReview("needs_revision").review;
    const next = {
      ...previous,
      technicalScore: previous.technicalScore + 5,
      blockingIssues: [{
        category: "navigation" as const,
        severity: "high" as const,
        viewId: "entrance",
        message: "The entrance is blocked.",
        suggestedFix: "Clear the entrance route.",
      }],
    };

    expect(classifyBuilderReviewChange(previous, next)).toBe("regressed");
    expect(didReviewImprove(previous, next)).toBe(false);
  });

  it("classifies a material score drop as regression despite another score gain", () => {
    const previous = createReview("needs_revision").review;
    const next = {
      ...previous,
      technicalScore: previous.technicalScore + 3,
      curatorialScore: previous.curatorialScore - 3,
    };

    expect(classifyBuilderReviewChange(previous, next)).toBe("regressed");
  });

  it("generates and accepts a scene when the first review passes", async () => {
    const requestBuilderSession = vi.fn().mockResolvedValue(createSession());
    const requestBuilderReview = vi.fn().mockResolvedValue(createReview("pass"));
    const requestBuilderRevision = vi.fn();
    const captureScreenshots = vi.fn().mockResolvedValue([
      { viewId: "entrance", label: "Entrance", dataUrl: "data:image/png;base64,aaa" },
    ]);

    const result = await runExhibitionBuilderAgent({
      token: "jwt-token",
      input: { prompt: "Macau memory", exhibitCount: 6 },
      requestBuilderSession,
      requestBuilderReview,
      requestBuilderRevision,
      captureScreenshots,
    });

    expect(result.review.review.overallStatus).toBe("pass");
    expect(result.stopReason).toBe("passed");
    expect(requestBuilderRevision).not.toHaveBeenCalled();
    expect(captureScreenshots).toHaveBeenCalledWith({ scene: createSession().scene });
  });

  it("stops after screenshot capture when the run is cancelled", async () => {
    const controller = new AbortController();
    const requestBuilderReview = vi.fn();

    await expect(runExhibitionBuilderAgent({
      token: "jwt-token",
      input: { prompt: "Macau memory" },
      signal: controller.signal,
      requestBuilderSession: vi.fn().mockResolvedValue(createSession()),
      requestBuilderReview,
      requestBuilderRevision: vi.fn(),
      captureScreenshots: vi.fn().mockImplementation(async () => {
        controller.abort("cancel builder run");
        return [];
      }),
    })).rejects.toMatchObject({ name: "AbortError" });

    expect(requestBuilderReview).not.toHaveBeenCalled();
  });

  it("resumes from an existing session without generating a new one", async () => {
    const requestBuilderSession = vi.fn();
    const steps: Array<{ phase: string; maxRevisions: number }> = [];
    const initialSession = createSession("version-2");

    const result = await runExhibitionBuilderAgent({
      token: "jwt-token",
      input: { prompt: "Continue Macau memory" },
      initialSession,
      requestBuilderSession,
      requestBuilderReview: vi.fn().mockResolvedValue({
        ...createReview("pass"),
        versionId: "version-2",
      }),
      requestBuilderRevision: vi.fn(),
      captureScreenshots: vi.fn().mockResolvedValue([]),
      onStep: (step) => steps.push(step),
    });

    expect(result.session).toBe(initialSession);
    expect(requestBuilderSession).not.toHaveBeenCalled();
    expect(steps.map((step) => step.phase)).toEqual(["capturing", "reviewing", "completed"]);
    expect(steps.every((step) => step.maxRevisions === 2)).toBe(true);
  });

  it("reviews but does not revise a resumed session at the server revision limit", async () => {
    const requestBuilderRevision = vi.fn();
    const initialSession = { ...createSession("version-2"), revisionCount: 3 };

    const result = await runExhibitionBuilderAgent({
      token: "jwt-token",
      input: { prompt: "Continue Macau memory" },
      initialSession,
      requestBuilderSession: vi.fn(),
      requestBuilderReview: vi.fn().mockResolvedValue({
        ...createReview("needs_revision"),
        versionId: "version-2",
      }),
      requestBuilderRevision,
      captureScreenshots: vi.fn().mockResolvedValue([]),
    });

    expect(result.stopReason).toBe("revision_limit");
    expect(requestBuilderRevision).not.toHaveBeenCalled();
  });

  it("revises and reviews again until the scene passes", async () => {
    const input = {
      prompt: "Macau memory",
      language: "en" as const,
      style: "immersive" as const,
      exhibitCount: 12,
      roomShape: "multi-room" as const,
      roomWidth: 32,
      roomLength: 48,
      assets: [{ title: "Archive film", imageUrl: "https://example.com/archive.jpg", type: "image" as const }],
    };
    const requestBuilderSession = vi.fn().mockResolvedValue(createSession());
    const requestBuilderReview = vi
      .fn()
      .mockResolvedValueOnce(createReview("needs_revision"))
      .mockResolvedValueOnce({ ...createReview("pass"), versionId: "version-2" });
    const requestBuilderRevision = vi.fn().mockResolvedValue(createSession("version-2"));

    const result = await runExhibitionBuilderAgent({
      token: "jwt-token",
      input,
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
        input,
        revisionCount: 0,
      }),
      undefined,
    );
    expect(requestBuilderReview).toHaveBeenCalledTimes(2);
  });

  it("stops without revising when visual review is unavailable", async () => {
    const requestBuilderRevision = vi.fn();
    const result = await runExhibitionBuilderAgent({
      token: "jwt-token",
      input: { prompt: "Macau memory" },
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

  it("stops with a quality regression reason after a harmful revision", async () => {
    const first = createReview("needs_revision");
    const regressed = {
      ...first,
      versionId: "version-2",
      review: {
        ...first.review,
        technicalScore: first.review.technicalScore + 3,
        curatorialScore: first.review.curatorialScore - 3,
      },
    };
    const requestBuilderRevision = vi.fn().mockResolvedValue(createSession("version-2"));

    const result = await runExhibitionBuilderAgent({
      token: "jwt-token",
      input: { prompt: "Macau memory" },
      requestBuilderSession: vi.fn().mockResolvedValue(createSession()),
      requestBuilderReview: vi.fn()
        .mockResolvedValueOnce(first)
        .mockResolvedValueOnce(regressed),
      requestBuilderRevision,
      captureScreenshots: vi.fn().mockResolvedValue([]),
      maxRevisions: 3,
    });

    expect(result.stopReason).toBe("quality_regression");
    expect(result.bestSession?.versionId).toBe("version-1");
    expect(result.session.versionId).toBe("version-2");
    expect(requestBuilderRevision).toHaveBeenCalledTimes(1);
  });

  it("stops before revision when the review needs manual changes", async () => {
    const review = createReview("needs_revision");
    const requestBuilderRevision = vi.fn();
    const result = await runExhibitionBuilderAgent({
      token: "jwt-token",
      input: { prompt: "Macau memory" },
      requestBuilderSession: vi.fn().mockResolvedValue(createSession()),
      requestBuilderReview: vi.fn().mockResolvedValue({ ...review, review: {
        ...review.review,
        blockingIssues: [{ category: "layout", severity: "high", viewId: "top-down",
          message: "The doorway is too narrow.", suggestedFix: "Widen the doorway.", resolution: "manual" }],
      } }),
      requestBuilderRevision,
      captureScreenshots: vi.fn().mockResolvedValue([]),
    });
    expect(result.stopReason).toBe("manual_required");
    expect(requestBuilderRevision).not.toHaveBeenCalled();
  });

  it("does not accept a passing review that materially regresses another score", async () => {
    const first = { ...createReview("needs_revision"), review: {
      ...createReview("needs_revision").review, technicalScore: 84, curatorialScore: 95,
    } };
    const result = await runExhibitionBuilderAgent({
      token: "jwt-token", input: { prompt: "Macau memory" },
      requestBuilderSession: vi.fn().mockResolvedValue(createSession()),
      requestBuilderReview: vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(createReview("pass")),
      requestBuilderRevision: vi.fn().mockResolvedValue(createSession("version-2")),
      captureScreenshots: vi.fn().mockResolvedValue([]),
    });
    expect(result.stopReason).toBe("quality_regression");
    expect(result.bestSession?.versionId).toBe("version-1");
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
