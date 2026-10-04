import type { BuilderAgentStep } from "./runExhibitionBuilderAgent";

export type BuilderAgentRunSummary = {
  reviewCount: number;
  revisionCount: number;
  initialScores: { technical: number; curatorial: number };
  latestScores: { technical: number; curatorial: number };
  technicalDelta: number;
  curatorialDelta: number;
};

export function summarizeBuilderAgentRun(
  steps: BuilderAgentStep[],
): BuilderAgentRunSummary | null {
  const scoredReviews = steps.flatMap((step) => step.scores ? [step.scores] : []);
  if (scoredReviews.length === 0) return null;

  const initialScores = scoredReviews[0];
  const latestScores = scoredReviews[scoredReviews.length - 1];

  return {
    reviewCount: scoredReviews.length,
    revisionCount: steps.filter((step) => step.phase === "revising").length,
    initialScores,
    latestScores,
    technicalDelta: latestScores.technical - initialScores.technical,
    curatorialDelta: latestScores.curatorial - initialScores.curatorial,
  };
}
