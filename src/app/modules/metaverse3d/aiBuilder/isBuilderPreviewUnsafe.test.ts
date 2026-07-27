import { describe, expect, it } from "vitest";

import type { BuilderReviewResponse } from "../../../api/exhibitionScene";
import { isBuilderPreviewUnsafe } from "./isBuilderPreviewUnsafe";

function response(severity: "low" | "medium" | "high"): BuilderReviewResponse {
  return {
    sessionId: "builder-1",
    versionId: "version-1",
    status: "reviewed",
    source: "fallback",
    review: {
      technicalScore: 70,
      curatorialScore: 78,
      overallStatus: "needs_revision",
      blockingIssues: [{
        category: "geometry",
        severity,
        viewId: "geometry-preflight",
        message: "floating bench",
        suggestedFix: "ground it",
      }],
      viewReviews: [],
      revisionPrompt: "ground furniture",
    },
  };
}

describe("isBuilderPreviewUnsafe", () => {
  it("blocks previews with high-severity local or visual review issues", () => {
    expect(isBuilderPreviewUnsafe(response("high"))).toBe(true);
  });

  it("allows previews without high-severity issues", () => {
    expect(isBuilderPreviewUnsafe(response("medium"))).toBe(false);
    expect(isBuilderPreviewUnsafe(null)).toBe(false);
  });
});
