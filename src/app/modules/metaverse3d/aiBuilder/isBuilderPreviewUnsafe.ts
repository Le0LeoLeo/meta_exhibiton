import type { BuilderReviewResponse } from "../../../api/exhibitionScene";

export function isBuilderPreviewUnsafe(review: BuilderReviewResponse | null) {
  return Boolean(review?.review?.blockingIssues.some((issue) => issue.severity === "high"));
}
